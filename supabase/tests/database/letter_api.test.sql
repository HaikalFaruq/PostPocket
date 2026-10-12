-- Uji fungsi database untuk Edge Functions. Jalankan: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- 1-3: rate limit
select is((select public.take_rate_limit('uji', '\x01', 2, interval '1 hour')), 0, 'jatah pertama diizinkan');
select is((select public.take_rate_limit('uji', '\x01', 2, interval '1 hour')), 0, 'jatah kedua diizinkan');
select ok((select public.take_rate_limit('uji', '\x01', 2, interval '1 hour')) between 3500 and 3600,
  'jatah ketiga ditolak dengan sisa detik sampai jatah tertua lepas');

-- 4: kunci lain punya jatah sendiri
select is((select public.take_rate_limit('uji', '\x02', 2, interval '1 hour')), 0, 'kunci lain tidak ikut habis');

-- 5: jatah yang lewat jendela dilepas
update public.rate_limit_hits set created_at = now() - interval '2 hours' where key = '\x01';
select is((select public.take_rate_limit('uji', '\x01', 2, interval '1 hour')), 0, 'jatah lama lepas setelah jendela lewat');

-- 6-8: create_letter
select lives_ok($$
  select public.create_letter(
    '00000000-0000-4000-8000-000000000001', '{"paper":"cream"}', '{"version":1,"elements":[]}',
    decode(repeat('ab', 32), 'hex'), null,
    '[{"kind":"photo","key":"p1","storage_path":"00000000-0000-4000-8000-000000000001/a.jpg","mime":"image/jpeg","size":1000,"width":10,"height":10},
      {"kind":"og","key":null,"storage_path":"00000000-0000-4000-8000-000000000001/b.jpg","mime":"image/jpeg","size":1000,"width":1200,"height":630}]')
$$, 'draf dan berkasnya dibuat');
select is((select count(*)::integer from public.letter_assets
  where letter_id = '00000000-0000-4000-8000-000000000001'), 2, 'dua baris berkas tercatat');
select throws_ok($$
  select public.create_letter(
    '00000000-0000-4000-8000-000000000002', '{}', '{}', decode(repeat('ab', 32), 'hex'), null,
    '[{"kind":"og","key":null,"storage_path":"00000000-0000-4000-8000-000000000002/b.jpg","mime":"image/gif","size":1,"width":1200,"height":630}]')
$$, '23514', null, 'berkas tidak valid menggagalkan seluruh draf');

-- 9: draf yang gagal tidak tersisa
select is((select count(*)::integer from public.letters where id = '00000000-0000-4000-8000-000000000002'), 0,
  'tidak ada draf setengah jadi');

-- 10-12: publish_letter
select is((select slug from public.publish_letter('00000000-0000-4000-8000-000000000001', 'AbCdE12345',
  '{"00000000-0000-4000-8000-000000000001/a.jpg": 900}')), 'AbCdE12345', 'draf terbit dengan slug');
select is((select size from public.letter_assets
  where storage_path = '00000000-0000-4000-8000-000000000001/a.jpg'), 900, 'ukuran setelah EXIF dibuang dicatat');
select is((select count(*)::integer from public.publish_letter('00000000-0000-4000-8000-000000000001', 'ZzZzZ12345', '{}')),
  0, 'publish kedua tidak mengubah apa pun');

-- 13-14: open_letter idempoten
create temp table opened as select opened_at, photos_expire_at from public.open_letter('AbCdE12345');
select ok((select photos_expire_at = opened_at + interval '7 days' from opened), 'foto dijadwalkan hapus 7 hari setelah dibuka');
select is((select opened_at from public.open_letter('AbCdE12345')), (select opened_at from opened),
  'dibuka lagi tidak mengubah opened_at');

-- 15-16: tertutup untuk klien
set local role anon;
select throws_ok($$select public.take_rate_limit('uji', '\x03', 1, interval '1 hour')$$, '42501', null,
  'anon tidak bisa memakai rate limit');
reset role;
set local role authenticated;
select throws_ok($$select * from public.open_letter('AbCdE12345')$$, '42501', null,
  'user login tidak bisa memanggil open_letter');
reset role;

select * from finish();
rollback;
