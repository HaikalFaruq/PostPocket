-- Uji migrasi letters + letter_assets. Jalankan: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Data bantu
create temp table t (name text primary key, id uuid);
grant all on t to anon, authenticated;

with created as (
  insert into public.letters (design, content, edit_token_hash)
  values ('{"paper":"cream"}', '{"version":1,"elements":[]}', decode(repeat('ab', 32), 'hex'))
  returning id
)
insert into t select 'draft', id from created;

-- 1-3: draf
select is((select status from public.letters where id = (select id from t where name = 'draft')),
  'draft', 'surat baru berstatus draft');
select ok((select draft_expires_at > now() + interval '23 hours' from public.letters
  where id = (select id from t where name = 'draft')), 'draf kedaluwarsa sekitar 24 jam');
select throws_ok(
  $$insert into public.letters (design, content, edit_token_hash)
    values ('{}', '{}', decode('abcd', 'hex'))$$,
  '23514', null, 'edit_token_hash wajib 32 byte (SHA-256)');

-- 4-6: bentuk status
select throws_ok(
  $$update public.letters set status = 'sent' where id = (select id from t where name = 'draft')$$,
  '23514', null, 'sent tanpa slug dan published_at ditolak');
select throws_ok(
  $$update public.letters set slug = 'x7Kp2qLm9A' where id = (select id from t where name = 'draft')$$,
  '23514', null, 'draft tidak boleh punya slug');
select lives_ok(
  $$update public.letters
    set status = 'sent', slug = 'x7Kp2qLm9A', published_at = now(),
        expires_at = now() + interval '30 days'
    where id = (select id from t where name = 'draft')$$,
  'publish dengan slug, published_at, dan expires_at diterima');

-- 7-9: slug dan dibuka
select throws_ok(
  $$insert into public.letters (design, content, edit_token_hash, status, slug, published_at, expires_at)
    values ('{}', '{}', decode(repeat('ab', 32), 'hex'), 'sent', 'pendek', now(), now() + interval '30 days')$$,
  '23514', null, 'slug wajib 10 karakter base62');
select throws_ok(
  $$update public.letters set opened_at = now() where id = (select id from t where name = 'draft')$$,
  '23514', null, 'opened_at tanpa photos_expire_at ditolak');
select lives_ok(
  $$update public.letters
    set opened_at = now(), photos_expire_at = least(now() + interval '7 days', expires_at)
    where id = (select id from t where name = 'draft')$$,
  'dibuka dengan jadwal hapus foto diterima');

-- 10-11: design dan content harus objek
select throws_ok(
  $$insert into public.letters (design, content, edit_token_hash) values ('[]', '{}', decode(repeat('ab', 32), 'hex'))$$,
  '23514', null, 'design harus objek JSON');
select throws_ok(
  $$insert into public.letters (design, content, edit_token_hash) values ('{}', '"x"', decode(repeat('ab', 32), 'hex'))$$,
  '23514', null, 'content harus objek JSON');

-- 12-18: berkas
create function pg_temp.asset(kind text, key text, mime text, size int, w int, h int)
returns void language sql as $$
  insert into public.letter_assets (letter_id, kind, key, storage_path, mime, size, width, height)
  select id, kind, key, id::text || '/' || gen_random_uuid()::text, mime, size, w, h
  from t where name = 'draft'
$$;

select lives_ok($$select pg_temp.asset('photo', 'p1', 'image/webp', 500000, 2048, 1536)$$,
  'foto 500 KB WebP diterima');
select throws_ok($$select pg_temp.asset('photo', 'p2', 'image/jpeg', 500001, 100, 100)$$,
  '23514', null, 'foto lebih dari 500.000 byte ditolak');
select throws_ok($$select pg_temp.asset('photo', 'p2', 'image/png', 1000, 100, 100)$$,
  '23514', null, 'foto PNG ditolak');
select throws_ok($$select pg_temp.asset('photo', null, 'image/jpeg', 1000, 100, 100)$$,
  '23514', null, 'foto tanpa key ditolak');
select throws_ok($$select pg_temp.asset('photo', 'p1', 'image/jpeg', 1000, 100, 100)$$,
  '23505', null, 'key foto unik per surat');
select lives_ok($$select pg_temp.asset('og', null, 'image/jpeg', 110000, 1200, 630)$$,
  'gambar OG JPEG 1200x630 diterima');
select throws_ok($$select pg_temp.asset('og', null, 'image/jpeg', 110000, 1200, 630)$$,
  '23505', null, 'satu gambar OG per surat');

-- 19-20: batas OG dan cover
select throws_ok($$select pg_temp.asset('cover', 'c', 'image/jpeg', 1000, 100, 100)$$,
  '23514', null, 'cover tidak boleh punya key');
select throws_ok(
  $$insert into public.letter_assets (letter_id, kind, storage_path, mime, size, width, height)
    select id, 'cover', 'lain/' || gen_random_uuid(), 'image/jpeg', 1000, 100, 100 from t where name = 'draft'$$,
  '23514', null, 'path berkas harus di folder surat sendiri');

-- 21: maksimal 4 foto (cover tidak dihitung)
select pg_temp.asset('cover', null, 'image/jpeg', 1000, 100, 100);
select pg_temp.asset('photo', 'p2', 'image/jpeg', 1000, 100, 100);
select pg_temp.asset('photo', 'p3', 'image/jpeg', 1000, 100, 100);
select pg_temp.asset('photo', 'p4', 'image/jpeg', 1000, 100, 100);
select throws_ok($$select pg_temp.asset('photo', 'p5', 'image/jpeg', 1000, 100, 100)$$,
  '23514', null, 'foto kelima ditolak');

-- 22: surat yang masih punya berkas tidak bisa dihapus
select throws_ok($$delete from public.letters where id = (select id from t where name = 'draft')$$,
  '23503', null, 'hapus surat gagal selama baris berkas masih ada');

-- 23-24: tertutup untuk klien
set local role anon;
select throws_ok($$select * from public.letters$$, '42501', null, 'anon tidak bisa membaca letters');
reset role;
set local role authenticated;
select throws_ok($$insert into public.letter_assets (letter_id, kind, storage_path, mime, size, width, height)
  values (gen_random_uuid(), 'og', 'x/y', 'image/png', 1, 1200, 630)$$,
  '42501', null, 'user login tidak bisa menulis letter_assets');
reset role;

-- 25-26: bucket
select is((select public from storage.buckets where id = 'letter-assets'), true,
  'bucket letter-assets publik untuk baca');
select is((select file_size_limit from storage.buckets where id = 'letter-assets'), 500000::bigint,
  'bucket menolak berkas lebih dari 500.000 byte');

select * from finish();
rollback;
