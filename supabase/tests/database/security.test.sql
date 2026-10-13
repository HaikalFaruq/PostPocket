-- Penjaga review keamanan (docs/backend.md, bagian Review keamanan): semua akses lewat Edge
-- Functions dengan secret key. Migrasi baru yang lupa revoke akan gagal di sini.
-- Jalankan: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- 1-2: tidak ada tabel atau view di public yang bisa disentuh publishable key atau user login
select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
      and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')),
  '{}'::text[], 'anon tidak punya hak di tabel atau view mana pun di public');
select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
      and has_table_privilege('authenticated', c.oid, 'select, insert, update, delete, truncate, references, trigger')),
  '{}'::text[], 'authenticated tidak punya hak di tabel atau view mana pun di public');

-- 3: semua tabel di public memakai RLS
select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  '{}'::text[], 'semua tabel di public memakai RLS');

-- 4: tidak ada fungsi di public yang bisa dipanggil lewat /rest/v1/rpc
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute'))),
  '{}'::text[], 'tidak ada fungsi di public yang bisa dijalankan anon atau authenticated');

-- 5: view memakai security_invoker, jadi tidak melewati RLS tabelnya
select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and not coalesce('security_invoker=true' = any (c.reloptions), false)),
  '{}'::text[], 'semua view di public memakai security_invoker');

-- 6: bucket letter-assets dibatasi ukuran dan tipe, tanpa policy di storage.objects
select ok(
  (select file_size_limit = 500000
      and allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png']
    from storage.buckets where id = 'letter-assets')
  and not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and (qual like '%letter-assets%' or with_check like '%letter-assets%')),
  'letter-assets: maksimal 500 KB, hanya gambar, tanpa policy listing atau upload');

select * from finish();
rollback;
