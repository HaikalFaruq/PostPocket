-- Pembersihan fase 2 (docs/backend.md, bagian Rancangan skema fase 2, Kuota).
--
-- Berkas di bucket moments selalu diunggah setelah barisnya ada (policy unggah), jadi berkas
-- tanpa baris moments aktif adalah sampah: momennya sudah dihapus, atau user-nya sudah dihapus
-- (baris ikut terhapus cascade). Edge Function cleanup menghapus berkas itu lewat Storage API,
-- lalu baris berstatus hapus dibuang di sini setelah 30 hari.

-- Path berkas momen, sama dengan yang diwajibkan policy moments_files_insert.
create function public.moment_file_path(p_owner uuid, p_id uuid, p_mime text)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_owner::text || '/' || p_id::text
    || case p_mime when 'image/webp' then '.webp' else '.jpg' end
$$;

revoke execute on function public.moment_file_path(uuid, uuid, text) from public, anon, authenticated;

-- Berkas di bucket moments yang tidak punya baris moments aktif, yang paling lama dulu. Hanya untuk
-- Edge Function cleanup (secret key).
create function public.orphan_moment_files(p_limit integer)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'moments'
    and not exists (
      select 1 from public.moments m
      where m.deleted_at is null
        and o.name = public.moment_file_path(m.owner_id, m.id, m.mime)
    )
  order by o.created_at
  limit p_limit
$$;

revoke execute on function public.orphan_moment_files(integer) from public, anon, authenticated;
grant execute on function public.orphan_moment_files(integer) to service_role;

create or replace function public.run_cleanup()
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
  delete from public.letter_events where occurred_at < now() - interval '13 months';
  delete from public.function_errors where occurred_at < now() - interval '30 days';

  -- Baris fase 2 berstatus hapus disimpan 30 hari supaya sampai ke perangkat lain lewat sinkron.
  -- Momen baru dibuang kalau berkasnya sudah tidak ada, supaya berkasnya tetap dikenali sampah.
  delete from public.pockets where deleted_at < now() - interval '30 days';
  delete from public.albums where deleted_at < now() - interval '30 days';
  delete from public.moments m
  where m.deleted_at < now() - interval '30 days'
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'moments'
        and o.name = public.moment_file_path(m.owner_id, m.id, m.mime)
    );

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

revoke execute on function public.run_cleanup() from public, anon, authenticated;
