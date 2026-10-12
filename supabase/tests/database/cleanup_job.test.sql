-- Uji job pembersihan (migrasi cleanup_job). Jalankan: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- 1-2: jadwal dan token
select is((select schedule from cron.job where jobname = 'pembersihan-surat'), '7 * * * *',
  'job pembersihan dijadwalkan tiap jam');
select is((select length(decrypted_secret) from vault.decrypted_secrets where name = 'cleanup_token'), 64,
  'cleanup_token acak 32 byte sudah ada di Vault');

-- 3-4: cleanup_token_valid
select ok(public.cleanup_token_valid(
  (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_token')),
  'token dari Vault diterima');
select ok(not public.cleanup_token_valid('salah'), 'token lain ditolak');

-- 5-6: run_cleanup tanpa project_url hanya membersihkan rate limit
delete from vault.secrets where name = 'project_url';
insert into public.rate_limit_hits (bucket, key, created_at) values
  ('uji', '\x01', now() - interval '2 hours'),
  ('uji', '\x02', now() - interval '10 minutes');
select is(public.run_cleanup(), null, 'tanpa project_url, Edge Function tidak dipanggil');
select is((select array_agg(key) from public.rate_limit_hits where bucket = 'uji'), array['\x02'::bytea],
  'jejak rate limit lebih tua dari 1 jam dihapus, yang baru tetap');

-- 7: dengan project_url, request ke Edge Function cleanup diantrekan pg_net
select vault.create_secret('http://contoh.invalid/', 'project_url');
create temp table cleanup_request as select public.run_cleanup() as id;
select ok((select url = 'http://contoh.invalid/functions/v1/cleanup'
    and headers ->> 'x-cleanup-token' = (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_token')
  from net.http_request_queue where id = (select id from cleanup_request)),
  'request ke /functions/v1/cleanup membawa x-cleanup-token');

-- 8-10: tertutup untuk klien
set local role anon;
select throws_ok($$ select public.cleanup_token_valid('x') $$, '42501', null,
  'anon tidak bisa memanggil cleanup_token_valid');
select throws_ok($$ select public.run_cleanup() $$, '42501', null, 'anon tidak bisa memanggil run_cleanup');
reset role;
set local role authenticated;
select throws_ok($$ select public.run_cleanup() $$, '42501', null,
  'user login tidak bisa memanggil run_cleanup');
reset role;

select * from finish();
rollback;
