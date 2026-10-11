-- Surat yang dikirim (rilis 1) dan berkasnya. Kontrak: docs/api/openapi.yaml.
--
-- Semua akses lewat Edge Functions dengan secret key. Tabel ini memakai RLS tanpa policy,
-- jadi publishable key (anon) dan user login tidak bisa membaca atau menulis langsung.
-- Policy per pemilik menyusul di fase 2 bersama login.

create table public.letters (
  id uuid primary key default gen_random_uuid(),
  slug text unique check (slug ~ '^[A-Za-z0-9]{10}$'),
  owner_id uuid references auth.users (id) on delete set null,
  design jsonb not null check (jsonb_typeof(design) = 'object'),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'sent')),
  -- SHA-256 dari edit token. Token mentah hanya dikirim sekali ke browser pengirim.
  edit_token_hash bytea not null check (octet_length(edit_token_hash) = 32),
  reply_to_id uuid references public.letters (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Draf yang tidak di-publish sampai waktu ini dihapus job pembersihan.
  draft_expires_at timestamptz not null default now() + interval '24 hours',
  published_at timestamptz,
  -- published_at + 30 hari: surat, gambar OG, dan semua berkas dihapus.
  expires_at timestamptz,
  opened_at timestamptz,
  -- least(opened_at + 7 hari, expires_at): foto (dan cover + OG kalau gambar depannya
  -- foto user) dihapus.
  photos_expire_at timestamptz,
  photos_deleted_at timestamptz,

  constraint letters_draft_or_sent check (
    (status = 'draft' and slug is null and published_at is null and expires_at is null
      and opened_at is null and photos_expire_at is null and photos_deleted_at is null)
    or (status = 'sent' and slug is not null and published_at is not null
      and expires_at > published_at)
  ),
  constraint letters_opened check (
    (opened_at is null and photos_expire_at is null)
    or (opened_at is not null and photos_expire_at is not null and photos_expire_at <= expires_at)
  ),
  constraint letters_not_self_reply check (reply_to_id is distinct from id)
);

comment on table public.letters is 'Surat rilis 1. Diakses hanya lewat Edge Functions (secret key).';

-- Antrean job pembersihan.
create index letters_draft_expiry_idx on public.letters (draft_expires_at) where status = 'draft';
create index letters_expiry_idx on public.letters (expires_at) where status = 'sent';
create index letters_photos_expiry_idx on public.letters (photos_expire_at)
  where photos_expire_at is not null and photos_deleted_at is null;
create index letters_reply_to_idx on public.letters (reply_to_id) where reply_to_id is not null;
create index letters_owner_idx on public.letters (owner_id) where owner_id is not null;

create table public.letter_assets (
  id uuid primary key default gen_random_uuid(),
  -- restrict, bukan cascade: berkas di Storage harus dihapus lewat Storage API dulu, baru
  -- barisnya. Menghapus surat yang masih punya baris berkas akan gagal, supaya tidak ada
  -- file yatim yang tetap memakan kuota.
  letter_id uuid not null references public.letters (id) on delete restrict,
  kind text not null check (kind in ('photo', 'cover', 'og')),
  -- Kunci foto di content.elements[].photo. Hanya untuk kind = 'photo'.
  key text check (key ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- <letter_id>/<uuid>.<ext> di bucket letter-assets.
  storage_path text not null unique,
  mime text not null,
  size integer not null check (size > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  -- Diisi saat publish setelah berkasnya dicek ada di Storage.
  uploaded_at timestamptz,

  constraint letter_assets_key check ((kind = 'photo') = (key is not null)),
  constraint letter_assets_path check (storage_path like letter_id::text || '/%'),
  constraint letter_assets_limits check (
    (kind in ('photo', 'cover') and mime in ('image/jpeg', 'image/webp')
      and size <= 500000 and width <= 2048 and height <= 2048)
    or (kind = 'og' and mime in ('image/jpeg', 'image/png')
      and size <= 300000 and width = 1200 and height = 630)
  )
);

comment on table public.letter_assets is 'Berkas surat di bucket letter-assets: foto isi, cover, dan gambar OG.';

create index letter_assets_letter_idx on public.letter_assets (letter_id);
create unique index letter_assets_photo_key_idx on public.letter_assets (letter_id, key)
  where kind = 'photo';
create unique index letter_assets_single_idx on public.letter_assets (letter_id, kind)
  where kind in ('cover', 'og');

-- Maksimal 4 foto per surat (cover tidak dihitung).
create function public.letter_assets_photo_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'photo' and (
    select count(*) from public.letter_assets
    where letter_id = new.letter_id and kind = 'photo' and id <> new.id
  ) >= 4 then
    raise exception 'Surat % sudah punya 4 foto', new.letter_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger letter_assets_photo_limit
  before insert or update of letter_id, kind on public.letter_assets
  for each row execute function public.letter_assets_photo_limit();

-- Tertutup untuk klien: tanpa policy, dan hak tabel dicabut sebagai lapis kedua.
alter table public.letters enable row level security;
alter table public.letter_assets enable row level security;
revoke all on table public.letters, public.letter_assets from anon, authenticated;
revoke execute on function public.letter_assets_photo_limit() from public, anon, authenticated;

-- Bucket berkas surat: publik untuk baca lewat URL dengan path acak. Tidak ada policy di
-- storage.objects, jadi klien tidak bisa listing atau upload langsung; upload hanya lewat
-- URL bertanda tangan yang dibuat Edge Function.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'letter-assets',
  'letter-assets',
  true,
  500000,
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
