-- Uji pembersihan fase 2 (migrasi moments_cleanup). Jalankan: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

delete from vault.secrets where name = 'project_url';

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'c@example.com');

-- Momen: aktif (c01), baru dihapus (c02), dihapus 31 hari lalu dengan berkas (c03) dan tanpa
-- berkas (c04), dan WebP aktif (c05).
insert into public.moments (id, owner_id, day, taken_at, source, width, height, mime, size, deleted_at)
values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-0000000000c1', '2026-10-14', now(), 'upload', 10, 10, 'image/jpeg', 1, null),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-0000000000c1', '2026-10-14', now(), 'upload', 10, 10, 'image/jpeg', 1, now()),
  ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-0000000000c1', '2026-10-14', now(), 'upload', 10, 10, 'image/jpeg', 1, now() - interval '31 days'),
  ('00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-0000000000c1', '2026-10-14', now(), 'upload', 10, 10, 'image/jpeg', 1, now() - interval '31 days'),
  ('00000000-0000-4000-8000-00000000c005', '00000000-0000-4000-8000-0000000000c1', '2026-10-14', now(), 'booth', 10, 10, 'image/webp', 1, null);

insert into storage.objects (bucket_id, name) values
  ('moments', '00000000-0000-4000-8000-0000000000c1/00000000-0000-4000-8000-00000000c001.jpg'),
  ('moments', '00000000-0000-4000-8000-0000000000c1/00000000-0000-4000-8000-00000000c002.jpg'),
  ('moments', '00000000-0000-4000-8000-0000000000c1/00000000-0000-4000-8000-00000000c003.jpg'),
  ('moments', '00000000-0000-4000-8000-0000000000c1/00000000-0000-4000-8000-00000000c005.webp'),
  -- Berkas user yang sudah dihapus (barisnya hilang lewat cascade).
  ('moments', '00000000-0000-4000-8000-0000000000d1/00000000-0000-4000-8000-00000000d001.jpg'),
  -- Bucket lain tidak disentuh.
  ('letter-assets', '00000000-0000-4000-8000-0000000000c1/x.jpg');

-- 1: berkas sampah = tanpa baris moments aktif, hanya di bucket moments
select is(
  (select array_agg(name order by name) from public.orphan_moment_files(100) as name),
  array[
    '00000000-0000-4000-8000-0000000000c1/00000000-0000-4000-8000-00000000c002.jpg',
    '00000000-0000-4000-8000-0000000000c1/00000000-0000-4000-8000-00000000c003.jpg',
    '00000000-0000-4000-8000-0000000000d1/00000000-0000-4000-8000-00000000d001.jpg'],
  'berkas momen terhapus dan berkas user terhapus dianggap sampah, momen aktif tidak');

-- 2: batas jumlah
select is((select count(*)::integer from public.orphan_moment_files(2)), 2, 'p_limit membatasi hasil');

-- 3-5: run_cleanup membuang baris berstatus hapus lebih dari 30 hari, momen hanya kalau berkasnya
-- sudah tidak ada
insert into public.pockets (owner_id, day, packet, sticker, frame, frame_color, saved_at, deleted_at)
values
  ('00000000-0000-4000-8000-0000000000c1', '2026-09-01', 'blue', 'heart', 'polaroid', 'cream', now(), now() - interval '31 days'),
  ('00000000-0000-4000-8000-0000000000c1', '2026-09-02', 'blue', 'heart', 'polaroid', 'cream', now(), now() - interval '29 days');
insert into public.albums (id, owner_id, title, emoji, color, deleted_at) values
  ('00000000-0000-4000-8000-00000000ca01', '00000000-0000-4000-8000-0000000000c1', 'Lama', '📀', '#7fb3f5', now() - interval '31 days'),
  ('00000000-0000-4000-8000-00000000ca02', '00000000-0000-4000-8000-0000000000c1', 'Aktif', '📀', '#7fb3f5', null);
select public.run_cleanup();
select is(
  (select array_agg(right(id::text, 4) order by id) from public.moments),
  array['c001', 'c002', 'c003', 'c005'],
  'momen terhapus > 30 hari dibuang kalau berkasnya sudah tidak ada (c004), tetap kalau masih ada (c003)');
select is((select array_agg(day order by day) from public.pockets), array['2026-09-02'::date],
  'kantong terhapus > 30 hari dibuang');
select is((select array_agg(title) from public.albums), array['Aktif'], 'album terhapus > 30 hari dibuang');

-- 6: path sama dengan yang diwajibkan policy unggah
select is(
  public.moment_file_path('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000c005', 'image/webp'),
  '00000000-0000-4000-8000-0000000000c1/00000000-0000-4000-8000-00000000c005.webp',
  'moment_file_path memakai .webp untuk WebP');

-- 7-9: tertutup untuk klien
set local role anon;
select throws_ok('select public.orphan_moment_files(1)', '42501', null, 'anon tidak bisa memanggil orphan_moment_files');
reset role;
set local role authenticated;
select throws_ok('select public.orphan_moment_files(1)', '42501', null, 'user login tidak bisa memanggil orphan_moment_files');
select throws_ok($$ select public.moment_file_path(gen_random_uuid(), gen_random_uuid(), 'image/jpeg') $$,
  '42501', null, 'user login tidak bisa memanggil moment_file_path');
reset role;

select * from finish();
rollback;
