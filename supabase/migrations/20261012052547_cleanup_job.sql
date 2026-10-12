-- Job pembersihan per jam (docs/backend.md, bagian Pembersihan file).
--
-- pg_cron menjalankan public.run_cleanup() tiap jam. Fungsi itu menghapus jejak rate limit
-- yang sudah lewat jendelanya langsung di SQL, lalu memanggil Edge Function `cleanup` lewat
-- pg_net untuk berkas surat. Berkas harus dihapus lewat Storage API, bukan dengan menghapus
-- baris storage.objects, supaya tidak ada file yatim yang tetap memakan kuota.
--
-- Dua isian Vault:
-- - cleanup_token dibuat di sini dengan nilai acak, jadi tidak pernah ada di repo dan tidak
--   perlu diset manual. Edge Function mencocokkannya lewat public.cleanup_token_valid().
-- - project_url diisi sekali per lingkungan (lihat docs/backend.md). Selama kosong, job hanya
--   membersihkan rate limit dan tidak memanggil Edge Function.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cleanup_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'cleanup_token',
      'Token header x-cleanup-token untuk Edge Function cleanup'
    );
  end if;
end;
$$;

create function public.cleanup_token_valid(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'cleanup_token' and decrypted_secret = p_token
  );
$$;

-- Mengembalikan id request pg_net, atau null kalau project_url belum diisi.
create function public.run_cleanup()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  token text;
begin
  -- Jendela rate limit terpanjang di Edge Functions adalah 1 jam (RATE_LIMIT di letters).
  delete from public.rate_limit_hits where created_at < now() - interval '1 hour';

  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  if base_url is null then
    raise notice 'project_url belum ada di Vault, Edge Function cleanup tidak dipanggil';
    return null;
  end if;
  select decrypted_secret into token from vault.decrypted_secrets where name = 'cleanup_token';

  return net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/cleanup',
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-cleanup-token', token),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.cleanup_token_valid(text) from public, anon, authenticated;
revoke execute on function public.run_cleanup() from public, anon, authenticated;

select cron.schedule('pembersihan-surat', '7 * * * *', 'select public.run_cleanup()');
