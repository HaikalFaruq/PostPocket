-- Uji migrasi hardening: batas baris Pocket per user, error fungsi account, berkas surat tanpa
-- baris, dan kolom letters.owner_id yang dibuang. Jalankan: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated', 'e@example.com'),
  ('00000000-0000-4000-8000-0000000000f1', 'authenticated', 'authenticated', 'f@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';

-- 1-4: kantong paling banyak 1500 per user, termasuk yang berstatus hapus
select lives_ok($$
  insert into public.pockets (day, packet, sticker, frame, frame_color, saved_at, deleted_at)
  select date '2020-01-01' + g, 'blue', 'heart', 'polaroid', 'cream', now(),
    case when g < 100 then now() end
  from generate_series(0, 1499) as g
$$, 'E bisa menyimpan 1500 kantong, 100 di antaranya berstatus hapus');
select throws_ok($$
  insert into public.pockets (day, packet, sticker, frame, frame_color, saved_at)
  values ('2026-10-16', 'blue', 'heart', 'polaroid', 'cream', now())
$$, '23514', 'kuota kantong penuh: maksimal 1500 kantong per user', 'kantong ke-1501 ditolak');
select lives_ok($$
  insert into public.pockets (day, packet, sticker, frame, frame_color, saved_at)
  values ('2020-01-01', 'pink', 'star', 'stamp', 'cream', now())
  on conflict (owner_id, day) do update set packet = excluded.packet, deleted_at = null
$$, 'kantong yang sudah ada tetap bisa di-upsert dan dipulihkan saat batas penuh');
select is((select packet || ':' || (deleted_at is null) from public.pockets where day = '2020-01-01'),
  'pink:true', 'upsert kantong di batas tersimpan');

-- 5-7: album paling banyak 200 per user
select lives_ok($$
  insert into public.albums (id, title, emoji, color)
  select ('00000000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'))::uuid, 'Album', '📀', '#7fb3f5'
  from generate_series(1, 200) as g
$$, 'E bisa membuat 200 album');
select throws_ok($$
  insert into public.albums (id, title, emoji, color)
  values (gen_random_uuid(), 'Lebih', '📀', '#7fb3f5')
$$, '23514', 'kuota album penuh: maksimal 200 album per user', 'album ke-201 ditolak');
select lives_ok($$
  insert into public.albums (id, title, emoji, color)
  values ('00000000-0000-4000-8000-000000000001', 'Ganti', '📀', '#7fb3f5')
  on conflict (id) do update set title = excluded.title
$$, 'album yang sudah ada tetap bisa di-upsert saat batas penuh');

-- 8-10: baris momen paling banyak 1000 per user, termasuk yang dikirim sudah berstatus hapus
select lives_ok($$
  insert into public.moments (id, day, taken_at, source, width, height, mime, size, deleted_at)
  select gen_random_uuid(), '2026-10-14', now(), 'upload', 800, 600, 'image/jpeg', 1000, now()
  from generate_series(1, 1000)
$$, 'E bisa punya 1000 baris momen berstatus hapus');
select throws_ok($$
  insert into public.moments (id, day, taken_at, source, width, height, mime, size, deleted_at)
  values (gen_random_uuid(), '2026-10-14', now(), 'upload', 800, 600, 'image/jpeg', 1000, now())
$$, '23514', 'kuota momen penuh: maksimal 1000 baris momen per user, termasuk yang dihapus',
  'baris momen ke-1001 ditolak walau berstatus hapus');
select lives_ok($$
  insert into public.moments (id, day, taken_at, source, width, height, mime, size)
  select id, day, taken_at, source, width, height, mime, size from public.moments limit 1
  on conflict (id) do update set deleted_at = null
$$, 'momen yang sudah ada tetap bisa dipulihkan saat batas baris penuh');

-- 11: batas dihitung per user
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select lives_ok($$
  insert into public.pockets (day, packet, sticker, frame, frame_color, saved_at)
  values ('2026-10-16', 'blue', 'heart', 'polaroid', 'cream', now())
$$, 'batas kantong E tidak memengaruhi F');

-- 12: berkas sampah hanya untuk job cleanup (hak fungsi lain dijaga security.test.sql)
select throws_ok('select public.orphan_letter_files(1)', '42501', null,
  'user login tidak bisa memanggil orphan_letter_files');
reset role;

-- 13: error fungsi account bisa dicatat
select lives_ok($$
  insert into public.function_errors (function, route, status, error_name)
  values ('account', '/account', 500, 'AuthApiError')
$$, 'function_errors menerima fungsi dan route account');

-- 14-17: berkas surat tanpa baris letter_assets
create temporary table t (name text primary key, id uuid) on commit drop;
with created as (
  insert into public.letters (design, content, edit_token_hash)
  values ('{}', '{}', decode(repeat('ab', 32), 'hex'))
  returning id
)
insert into t select 'surat', id from created;
insert into public.letter_assets (letter_id, kind, key, storage_path, mime, size, width, height)
select id, 'photo', 'p1', id || '/ada.jpg', 'image/jpeg', 1000, 800, 600 from t;
insert into storage.objects (bucket_id, name, created_at)
select 'letter-assets', id || '/ada.jpg', now() - interval '2 days' from t
union all select 'letter-assets', '00000000-0000-4000-8000-00000000dead/lama.jpg', now() - interval '2 days'
union all select 'letter-assets', '00000000-0000-4000-8000-00000000dead/baru.jpg', now()
-- Bucket lain tidak disentuh.
union all select 'moments', '00000000-0000-4000-8000-0000000000e1/x.jpg', now() - interval '3 days';

select is(
  (select array_agg(name order by name) from public.orphan_letter_files(100) as name),
  array['00000000-0000-4000-8000-00000000dead/baru.jpg', '00000000-0000-4000-8000-00000000dead/lama.jpg'],
  'hanya berkas letter-assets yang tidak punya baris letter_assets');
select is(array(select public.orphan_letter_files(1)),
  array['00000000-0000-4000-8000-00000000dead/lama.jpg'], 'p_limit membatasi hasil, yang paling lama dulu');
set local role anon;
select throws_ok('select public.orphan_letter_files(1)', '42501', null,
  'anon tidak bisa memanggil orphan_letter_files');
reset role;
select ok(has_function_privilege('service_role', 'public.orphan_letter_files(integer)', 'execute'),
  'service_role (Edge Function cleanup) bisa memanggil orphan_letter_files');

-- 18-19: letters.owner_id dibuang, surat tetap bisa dibuat
select hasnt_column('public', 'letters', 'owner_id', 'letters tidak punya owner_id lagi');
select is((select count(*)::integer from public.letters where id = (select id from t)), 1,
  'surat tetap bisa dibuat tanpa owner_id');

select * from finish();
rollback;
