-- Pengerasan sebelum rilis 1.0, dari audit keamanan backend (docs/backend.md, bagian Review
-- keamanan):
--
-- 1. Batas baris Pocket per user. Kuota 100 momen aktif tidak membatasi kantong, album, maupun
--    baris momen yang dikirim sudah berstatus hapus, jadi satu akun Google bisa mengisi database
--    500 MB lewat upsert biasa. Batasnya jauh di atas pemakaian wajar dan ikut menghitung baris
--    berstatus hapus (disimpan 30 hari).
-- 2. function_errors menerima error dari fungsi account, yang sebelumnya selalu ditolak check.
-- 3. Berkas letter-assets tanpa baris letter_assets bisa ditemukan job cleanup.
-- 4. letters.owner_id dibuang: tidak pernah diisi, surat tidak terikat ke akun.

-- 1. Batas baris per user. Hanya baris baru yang dihitung: trigger BEFORE INSERT juga jalan untuk
-- upsert (INSERT ... ON CONFLICT DO UPDATE) baris yang sudah ada, dan user yang sudah di batas
-- harus tetap bisa mengubah atau memulihkan barisnya. Kunci per user mencegah dua insert
-- bersamaan sama-sama lolos, seperti moments_quota.
create function public.pockets_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('pockets_quota:' || new.owner_id::text, 0));
  if not exists (
    select 1 from public.pockets where owner_id = new.owner_id and day = new.day
  ) and (select count(*) from public.pockets where owner_id = new.owner_id) >= 1500 then
    raise exception 'kuota kantong penuh: maksimal 1500 kantong per user'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create function public.albums_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('albums_quota:' || new.owner_id::text, 0));
  if not exists (select 1 from public.albums where id = new.id)
    and (select count(*) from public.albums where owner_id = new.owner_id) >= 200 then
    raise exception 'kuota album penuh: maksimal 200 album per user'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Kunci yang sama dengan moments_quota, jadi kedua batas momen dicek berurutan per user.
create function public.moments_rows_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('moments_quota:' || new.owner_id::text, 0));
  if not exists (select 1 from public.moments where id = new.id)
    and (select count(*) from public.moments where owner_id = new.owner_id) >= 1000 then
    raise exception 'kuota momen penuh: maksimal 1000 baris momen per user, termasuk yang dihapus'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function
  public.pockets_quota(),
  public.albums_quota(),
  public.moments_rows_quota()
from public, anon, authenticated;

create trigger pockets_quota before insert on public.pockets
  for each row execute function public.pockets_quota();
create trigger albums_quota before insert on public.albums
  for each row execute function public.albums_quota();
create trigger moments_rows_quota before insert on public.moments
  for each row execute function public.moments_rows_quota();

-- 2. Catatan error untuk fungsi account (_shared/errors.ts sudah mengirim 'account' dan
-- '/account').
alter table public.function_errors
  drop constraint function_errors_function_check,
  add constraint function_errors_function_check check (
    function in ('letters', 'l', 'cleanup', 'boxes', 'k', 'account')
  ),
  drop constraint function_errors_route_check,
  add constraint function_errors_route_check check (route in (
    '/letters', '/letters/:id', '/letters/:id/publish', '/l/:slug', '/l/:slug/open', '/cleanup',
    '/boxes', '/boxes/:id', '/boxes/:id/letters/:letterId', '/boxes/invite/:invite', '/k/:slug',
    '/k/:slug/open', '/account', '/:other'
  ));

-- 3. Berkas di bucket letter-assets yang tidak punya baris letter_assets, yang paling lama dulu.
-- Berkas surat selalu diunggah setelah barisnya dibuat create_letter(), dan dihapus dari Storage
-- sebelum barisnya, jadi berkas tanpa baris adalah sisa: diunggah lewat URL upload (berlaku 2 jam
-- dan tidak bisa dicabut) setelah suratnya dihapus. Hanya untuk Edge Function cleanup (secret key).
create function public.orphan_letter_files(p_limit integer)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'letter-assets'
    and not exists (select 1 from public.letter_assets a where a.storage_path = o.name)
  order by o.created_at
  limit p_limit
$$;

revoke execute on function public.orphan_letter_files(integer) from public, anon, authenticated;
grant execute on function public.orphan_letter_files(integer) to service_role;

-- 4. Kolom yang tidak pernah diisi. Indeks dan foreign key-nya ikut terhapus.
alter table public.letters drop column owner_id;
