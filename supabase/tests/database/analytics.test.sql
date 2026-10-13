-- Uji event analitik dan catatan error (migrasi analytics). Jalankan: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- Draf surat dan balasannya.
select public.create_letter(
  '00000000-0000-4000-8000-0000000000a1', '{}', '{"version":1,"elements":[]}',
  decode(repeat('ab', 32), 'hex'), null, '[]');
select public.create_letter(
  '00000000-0000-4000-8000-0000000000a2', '{}', '{"version":1,"elements":[]}',
  decode(repeat('ab', 32), 'hex'), '00000000-0000-4000-8000-0000000000a1', '[]');

-- 1: draf belum dihitung
select is((select count(*)::integer from public.letter_events), 0, 'draf yang belum di-publish tidak dihitung');

-- 2-4: publish mencatat created, waktunya dibulatkan ke jam
select public.publish_letter('00000000-0000-4000-8000-0000000000a1', 'AnalitikA1', '{}');
select is((select array_agg(kind) from public.letter_events), array['created'], 'publish mencatat created');
select is((select after_hours from public.letter_events where kind = 'created'), null, 'created tanpa after_hours');
select is((select occurred_at from public.letter_events where kind = 'created'), date_trunc('hour', now(), 'UTC'),
  'occurred_at dibulatkan ke jam, tidak sama dengan published_at');

-- 5-6: dibuka pertama kali, sekali saja
update public.letters set published_at = now() - interval '5 hours 30 minutes'
  where id = '00000000-0000-4000-8000-0000000000a1';
select public.open_letter('AnalitikA1');
select public.open_letter('AnalitikA1');
select is((select count(*)::integer from public.letter_events where kind = 'opened'), 1,
  'dibuka dua kali tetap satu event opened');
select is((select after_hours from public.letter_events where kind = 'opened'), 5, 'after_hours jam penuh sejak publish');

-- 7: publish balasan mencatat created dan replied
select public.publish_letter('00000000-0000-4000-8000-0000000000a2', 'AnalitikA2', '{}');
select is((select array_agg(kind || ':' || coalesce(after_hours::text, '-') order by id) from public.letter_events),
  array['created:-', 'opened:5', 'created:-', 'replied:5'], 'balasan dihitung sebagai created dan replied');

-- 8: perubahan lain di letters tidak mencatat event
update public.letters set photos_deleted_at = now() where id = '00000000-0000-4000-8000-0000000000a1';
select is((select count(*)::integer from public.letter_events), 4, 'kolom lain tidak memicu event');

-- 9: event tetap ada setelah suratnya dihapus
delete from public.letters where id in ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a1');
select is((select count(*)::integer from public.letter_events), 4, 'event tetap ada setelah surat dihapus');

-- 10: view mingguan
select is((select week || ':' || total from public.letter_stats_weekly where kind = 'created'),
  date_trunc('week', now() at time zone 'Asia/Jakarta')::date || ':2',
  'letter_stats_weekly menghitung per jenis per minggu WIB (Senin)');

-- 11-14: function_errors hanya menerima pola, nama, dan kode
select lives_ok($$
  insert into public.function_errors (function, route, status, error_name, error_code)
  values ('l', '/l/:slug', 500, 'PostgrestError', '57014')
$$, 'error dengan pola route, nama, dan kode diterima');
select throws_ok($$
  insert into public.function_errors (function, route, status) values ('l', '/l/abcdefghij', 500)
$$, '23514', null, 'route berisi slug ditolak');
select throws_ok($$
  insert into public.function_errors (function, route, status, error_name)
  values ('letters', '/letters', 500, 'invalid input syntax for type uuid: "x"')
$$, '23514', null, 'pesan error ditolak sebagai nama');
select is((select total::integer from public.function_errors_daily where route = '/l/:slug'), 1,
  'function_errors_daily merangkum per hari');

-- 15: run_cleanup membuang event lebih tua dari 13 bulan dan error lebih tua dari 30 hari
insert into public.letter_events (kind, occurred_at) values ('created', date_trunc('hour', now() - interval '14 months', 'UTC'));
insert into public.function_errors (function, route, status, occurred_at) values ('l', '/l/:slug', 500, now() - interval '31 days');
delete from vault.secrets where name = 'project_url';
select public.run_cleanup();
select is(
  (select count(*)::integer from public.letter_events) * 10 + (select count(*)::integer from public.function_errors),
  41, 'run_cleanup menghapus event dan error yang lewat masa simpan');

-- 16-23: tertutup untuk publishable key dan user login
set local role anon;
select throws_ok('select * from public.letter_events', '42501', null, 'anon tidak bisa membaca letter_events');
select throws_ok('select * from public.function_errors', '42501', null, 'anon tidak bisa membaca function_errors');
select throws_ok('select * from public.letter_stats_weekly', '42501', null, 'anon tidak bisa membaca letter_stats_weekly');
select throws_ok('select * from public.function_errors_daily', '42501', null, 'anon tidak bisa membaca function_errors_daily');
reset role;
set local role authenticated;
select throws_ok('select * from public.letter_events', '42501', null, 'user login tidak bisa membaca letter_events');
select throws_ok('select * from public.function_errors', '42501', null, 'user login tidak bisa membaca function_errors');
select throws_ok('select * from public.letter_stats_weekly', '42501', null, 'user login tidak bisa membaca letter_stats_weekly');
select throws_ok('select * from public.function_errors_daily', '42501', null, 'user login tidak bisa membaca function_errors_daily');
reset role;

select * from finish();
rollback;
