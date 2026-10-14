-- Uji skema fase 2 (migrasi phase2): RLS per user, kuota 100 momen, dan bucket moments.
-- Jalankan: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- Dua user: A (…a1) dan B (…b1).
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'a@example.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'b@example.com');

-- 1: profil dibuat otomatis saat user mendaftar, tanpa nama dari akun
select is((select count(*)::integer from public.profiles where display_name is null), 2,
  'profil dibuat trigger saat user mendaftar');

-- Masuk sebagai A.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

-- 2-4: A membuat momen, kantong, dan album; owner_id terisi sendiri, updated_at dari server
select lives_ok($$
  insert into public.moments (id, day, taken_at, source, width, height, mime, size, updated_at)
  values ('00000000-0000-4000-8000-00000000a001', '2026-10-14', '2026-10-14 09:00+07', 'booth',
    800, 600, 'image/jpeg', 120000, '2000-01-01')
$$, 'A bisa membuat momen');
select lives_ok($$
  insert into public.pockets (day, packet, sticker, frame, frame_color, moment_ids, saved_at)
  values ('2026-10-14', 'blue', 'heart', 'polaroid', '#ffaa00',
    array['00000000-0000-4000-8000-00000000a001']::uuid[], now())
$$, 'A bisa membuat kantong dengan warna bingkai custom');
select lives_ok($$
  insert into public.albums (id, title, emoji, color, moment_ids)
  values ('00000000-0000-4000-8000-00000000a0a1', 'Liburan', '🏖️', '#7fb3f5',
    array['00000000-0000-4000-8000-00000000a001']::uuid[])
$$, 'A bisa membuat album');
select is(
  (select owner_id::text || ':' || (updated_at > '2001-01-01') from public.moments),
  '00000000-0000-4000-8000-0000000000a1:true',
  'owner_id dari sesi, updated_at dari server (nilai dari browser diabaikan)');

-- 6: upsert kantong di hari yang sama jadi satu baris
select lives_ok($$
  insert into public.pockets (day, packet, sticker, frame, frame_color, saved_at)
  values ('2026-10-14', 'pink', 'star', 'stamp', 'cream', now())
  on conflict (owner_id, day) do update set packet = excluded.packet
$$, 'upsert kantong on conflict (owner_id, day)');
select is((select count(*)::integer || ':' || max(packet) from public.pockets), '1:pink',
  'kantong hari yang sama tetap satu baris');

-- 8-10: bentuk kolom dijaga
select throws_ok($$
  insert into public.pockets (day, packet, sticker, frame, frame_color, saved_at)
  values ('2026-10-15', 'blue', 'heart', 'polaroid', 'url(javascript:x)', now())
$$, '23514', null, 'warna bingkai yang bukan id preset atau #rrggbb ditolak');
select throws_ok($$
  insert into public.albums (id, title, emoji, color, moment_ids)
  select '00000000-0000-4000-8000-00000000a0a2', 'Banyak', '📀', '#7fb3f5',
    array_agg(gen_random_uuid()) from generate_series(1, 501)
$$, '23514', null, 'album dengan lebih dari 500 momen ditolak');
select throws_ok($$
  insert into public.moments (id, day, taken_at, source, width, height, mime, size)
  values (gen_random_uuid(), '2026-10-14', now(), 'upload', 800, 600, 'image/png', 600000)
$$, '23514', null, 'momen PNG atau di atas 500 KB ditolak');

-- 11: tidak bisa membuat baris atas nama user lain
select throws_ok($$
  insert into public.moments (id, owner_id, day, taken_at, source, width, height, mime, size)
  values (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', '2026-10-14', now(),
    'upload', 800, 600, 'image/jpeg', 1000)
$$, '42501', null, 'A tidak bisa membuat momen atas nama B');

-- 12: hapus dari browser hanya lewat deleted_at
select throws_ok('delete from public.moments', '42501', null, 'authenticated tidak bisa delete');

-- 13-14: bucket moments, unggah hanya untuk momen aktif dengan nama berkas yang sama
select lives_ok($$
  insert into storage.objects (bucket_id, name)
  values ('moments', '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-00000000a001.jpg')
$$, 'A bisa mengunggah berkas untuk momennya');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('moments', '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-00000000a999.jpg')
$$, '42501', null, 'unggah tanpa baris moments ditolak');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('moments', '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-00000000a001.webp')
$$, '42501', null, 'unggah dengan ekstensi yang tidak cocok dengan mime ditolak');

-- Masuk sebagai B.
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}';

-- 16-21: B tidak melihat atau mengubah apa pun milik A
select is((select count(*)::integer from public.moments), 0, 'B tidak melihat momen A');
select is((select count(*)::integer from public.pockets), 0, 'B tidak melihat kantong A');
select is((select count(*)::integer from public.albums), 0, 'B tidak melihat album A');
select is((select count(*)::integer from public.profiles), 1, 'B hanya melihat profilnya sendiri');
select is((select count(*)::integer from storage.objects where bucket_id = 'moments'), 0,
  'B tidak melihat berkas A');
update public.moments set deleted_at = now();
update public.albums set title = 'Dibajak';
reset role;
select is(
  (select count(*)::integer from public.moments where deleted_at is null)
    + (select count(*)::integer from public.albums where title = 'Liburan'),
  2, 'update dari B tidak mengubah baris A');
set local role authenticated;

-- 22-23: B tidak bisa mengunggah ke folder A, bahkan untuk momen A yang aktif
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('moments', '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-00000000a001.jpg')
$$, '42501', null, 'B tidak bisa mengunggah ke folder A');
select throws_ok($$
  update public.profiles set id = '00000000-0000-4000-8000-0000000000a1'
$$, '42501', null, 'B tidak bisa mengubah id profilnya');

-- 24-27: kuota 100 momen aktif
select lives_ok($$
  insert into public.moments (id, day, taken_at, source, width, height, mime, size)
  select gen_random_uuid(), '2026-10-14', now(), 'upload', 800, 600, 'image/jpeg', 1000
  from generate_series(1, 100)
$$, 'B bisa menyimpan 100 momen');
select throws_ok($$
  insert into public.moments (id, day, taken_at, source, width, height, mime, size)
  values ('00000000-0000-4000-8000-00000000b101', '2026-10-14', now(), 'upload', 800, 600,
    'image/jpeg', 1000)
$$, '23514', 'kuota momen penuh: maksimal 100 foto per user', 'momen ke-101 ditolak');
update public.moments set deleted_at = now()
  where id = (select id from public.moments order by id limit 1);
select lives_ok($$
  insert into public.moments (id, day, taken_at, source, width, height, mime, size)
  values ('00000000-0000-4000-8000-00000000b101', '2026-10-14', now(), 'upload', 800, 600,
    'image/jpeg', 1000)
$$, 'setelah satu dihapus, momen baru diterima');
select throws_ok($$
  update public.moments set deleted_at = null where deleted_at is not null
$$, '23514', null, 'memulihkan momen yang dihapus saat kuota penuh ditolak');

-- 28: unggah untuk momen yang sudah dihapus ditolak
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  select 'moments', '00000000-0000-4000-8000-0000000000b1/' || id || '.jpg'
  from public.moments where deleted_at is not null
$$, '42501', null, 'unggah untuk momen yang sudah dihapus ditolak');

-- 29: kuota A tidak terpengaruh momen B
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select lives_ok($$
  insert into public.moments (id, day, taken_at, source, width, height, mime, size)
  values (gen_random_uuid(), '2026-10-15', now(), 'upload', 800, 600, 'image/jpeg', 1000)
$$, 'kuota dihitung per user');
reset role;

-- 30-31: anon tidak punya akses sama sekali
set local role anon;
select throws_ok('select * from public.moments', '42501', null, 'anon tidak bisa membaca moments');
select is((select count(*)::integer from storage.objects where bucket_id = 'moments'), 0,
  'anon tidak melihat berkas di bucket moments');
reset role;

-- 32: hapus akun menghapus semua barisnya. Berkasnya tidak: storage.objects tidak boleh dihapus
-- lewat SQL, jadi hapus akun nanti lewat Edge Function yang menghapus berkas dulu.
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
select is(
  (select count(*)::integer from public.moments where owner_id = '00000000-0000-4000-8000-0000000000a1')
    + (select count(*)::integer from public.pockets where owner_id = '00000000-0000-4000-8000-0000000000a1')
    + (select count(*)::integer from public.albums where owner_id = '00000000-0000-4000-8000-0000000000a1')
    + (select count(*)::integer from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'),
  0, 'hapus user menghapus profil, momen, kantong, dan album');

select * from finish();
rollback;
