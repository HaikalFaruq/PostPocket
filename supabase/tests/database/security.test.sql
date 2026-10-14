-- Penjaga review keamanan (docs/backend.md, bagian Review keamanan): semua akses lewat Edge
-- Functions dengan secret key. Migrasi baru yang lupa revoke akan gagal di sini.
-- Jalankan: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- 1-2: publishable key tidak menyentuh tabel atau view mana pun di public
select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
      and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')),
  '{}'::text[], 'anon tidak punya hak di tabel atau view mana pun di public');
-- User login hanya menyentuh tabel fase 2, dan hanya select, insert, update (tanpa delete).
select is(
  (select coalesce(array_agg(c.relname || ':' || p.privilege order by c.relname, p.privilege), '{}')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references',
      'trigger']) as p(privilege)
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
      and has_table_privilege('authenticated', c.oid, p.privilege)),
  array['albums:insert', 'albums:select', 'albums:update', 'moments:insert', 'moments:select',
    'moments:update', 'pockets:insert', 'pockets:select', 'pockets:update', 'profiles:select'],
  'authenticated hanya punya select/insert/update di tabel fase 2 (profiles: select dan update display_name)');

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

-- 6: bucket letter-assets dibatasi ukuran dan tipe
select ok(
  (select file_size_limit = 500000
      and allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png']
    from storage.buckets where id = 'letter-assets'),
  'letter-assets: maksimal 500 KB, hanya gambar');

-- 7-8: storage tanpa policy untuk publishable key. Policy tanpa `to` berlaku untuk role public
-- (termasuk anon), dan policy umum seperti `using (true)` tidak menyebut nama bucket, jadi yang
-- dicek role-nya, bukan isinya. Untuk user login hanya policy bucket moments yang memeriksa
-- auth.uid() (fase 2).
select is(
  (select coalesce(array_agg(tablename || '.' || policyname order by tablename, policyname), '{}')
    from pg_policies
    where schemaname = 'storage'
      and roles && array['public', 'anon']::name[]),
  '{}'::text[], 'storage tanpa policy untuk public atau anon');
select is(
  (select coalesce(array_agg(tablename || '.' || policyname order by tablename, policyname), '{}')
    from pg_policies
    where schemaname = 'storage'
      and 'authenticated' = any (roles)
      and not (
        tablename = 'objects'
        and coalesce(qual, with_check) like '%bucket_id = ''moments''%'
        and coalesce(qual, '') || coalesce(with_check, '') like '%auth.uid()%'
      )),
  '{}'::text[], 'policy storage untuk authenticated hanya di bucket moments dan memeriksa auth.uid()');

select * from finish();
rollback;
