-- Skema fase 2: cadangan dan sinkron Pocket untuk user yang login (docs/backend.md, bagian
-- Rancangan skema fase 2).
--
-- Bentuknya mengikuti data Pocket di browser (apps/web/app/utils/memories.ts). Akses lewat
-- supabase-js dengan sesi user dan RLS owner_id = auth.uid(); anon tidak punya hak apa pun.
-- Hapus dari browser selalu lewat deleted_at supaya sampai ke perangkat lain, jadi
-- authenticated tidak dapat hak delete.

-- updated_at selalu dari server, supaya jam HP yang salah tidak merusak urutan sinkron.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Profil, satu per user. display_name sengaja tidak diambil dari akun Google; user mengisinya
-- sendiri kalau mau.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil user fase 2. Dibuat trigger saat user mendaftar.';

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select, update (display_name) on table public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create function public.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.create_profile() from public, anon, authenticated;

create trigger auth_users_create_profile
  after insert on auth.users
  for each row execute function public.create_profile();

-- Momen: satu foto kenangan. Berkasnya di bucket moments, path <owner_id>/<id>.jpg atau .webp.
create table public.moments (
  -- Dibuat browser (crypto.randomUUID), supaya upsert dari perangkat offline tidak jadi ganda.
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Hari kantongnya (tanggal lokal user). Momen bisa ada sebelum kantongnya disimpan.
  day date not null,
  taken_at timestamptz not null,
  source text not null check (source in ('upload', 'booth')),
  width integer not null check (width between 1 and 2048),
  height integer not null check (height between 1 and 2048),
  mime text not null check (mime in ('image/jpeg', 'image/webp')),
  size integer not null check (size between 1 and 500000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.moments is 'Foto Pocket per user. Berkasnya di bucket moments.';

create index moments_owner_updated_idx on public.moments (owner_id, updated_at);

-- Kantong satu hari. Dikunci per hari seperti PocketDay, supaya kantong hari yang sama dari dua
-- perangkat offline bertemu di satu baris.
create table public.pockets (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  -- Id preset di packages/presets; database hanya mengecek bentuknya.
  packet text not null check (packet ~ '^[A-Za-z0-9-]{1,40}$'),
  sticker text not null check (sticker ~ '^[A-Za-z0-9-]{1,40}$'),
  frame text not null check (frame ~ '^[A-Za-z0-9-]{1,40}$'),
  -- Id preset warna bingkai, atau warna custom #rrggbb.
  frame_color text not null check (frame_color ~ '^([A-Za-z0-9-]{1,40}|#[0-9A-Fa-f]{6})$'),
  -- Urutan momen di kantong.
  moment_ids uuid[] not null default '{}' check (cardinality(moment_ids) <= 500),
  saved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (owner_id, day)
);

comment on table public.pockets is 'Kantong Pocket per hari per user.';

create index pockets_owner_updated_idx on public.pockets (owner_id, updated_at);

-- Album CD buatan user. Album per bulan dihitung browser dari moments.day dan tidak disimpan.
create table public.albums (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  emoji text not null check (char_length(emoji) between 1 and 8),
  -- Warna punggung CD.
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Urutan momen di CD.
  moment_ids uuid[] not null default '{}' check (cardinality(moment_ids) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.albums is 'Album CD buatan user.';

create index albums_owner_updated_idx on public.albums (owner_id, updated_at);

-- Hak dan RLS yang sama untuk ketiga tabel: hanya baris sendiri, tanpa delete.
alter table public.moments enable row level security;
alter table public.pockets enable row level security;
alter table public.albums enable row level security;
revoke all on table public.moments, public.pockets, public.albums from anon, authenticated;
grant select, insert, update on table public.moments, public.pockets, public.albums
  to authenticated;

create policy moments_select on public.moments for select to authenticated
  using (owner_id = (select auth.uid()));
create policy moments_insert on public.moments for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy moments_update on public.moments for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy pockets_select on public.pockets for select to authenticated
  using (owner_id = (select auth.uid()));
create policy pockets_insert on public.pockets for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy pockets_update on public.pockets for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy albums_select on public.albums for select to authenticated
  using (owner_id = (select auth.uid()));
create policy albums_insert on public.albums for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy albums_update on public.albums for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create trigger moments_touch before insert or update on public.moments
  for each row execute function public.touch_updated_at();
create trigger pockets_touch before insert or update on public.pockets
  for each row execute function public.touch_updated_at();
create trigger albums_touch before insert or update on public.albums
  for each row execute function public.touch_updated_at();

-- Kuota beta: maksimal 100 momen aktif per user. Dicek saat momen dibuat atau dipulihkan
-- (deleted_at dikosongkan). Kunci per user mencegah dua insert bersamaan sama-sama lolos.
create function public.moments_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is null and (tg_op = 'INSERT' or old.deleted_at is not null) then
    perform pg_advisory_xact_lock(hashtextextended('moments_quota:' || new.owner_id::text, 0));
    if (
      select count(*) from public.moments
      where owner_id = new.owner_id and deleted_at is null and id <> new.id
    ) >= 100 then
      raise exception 'kuota momen penuh: maksimal 100 foto per user'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.moments_quota() from public, anon, authenticated;

create trigger moments_quota before insert or update of deleted_at on public.moments
  for each row execute function public.moments_quota();

-- Bucket foto Pocket: privat, dibaca lewat signed URL. Tanpa policy update, jadi berkas tidak
-- bisa ditimpa. Tanpa policy untuk anon.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moments', 'moments', false, 500000, array['image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy moments_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'moments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy moments_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'moments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Unggah hanya untuk momen aktif milik user dengan nama berkas yang persis sama, supaya kuota
-- di tabel moments tidak bisa dilewati lewat Storage (satu baris, satu berkas).
create policy moments_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'moments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.moments m
      where m.owner_id = (select auth.uid())
        and m.deleted_at is null
        and name = m.owner_id::text || '/' || m.id::text
          || case m.mime when 'image/webp' then '.webp' else '.jpg' end
    )
  );
