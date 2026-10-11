-- Fungsi database untuk Edge Functions `letters` dan `l`, plus rate limit pembuatan surat.
--
-- Semua fungsi di sini hanya bisa dijalankan service role (secret key). Hak `anon` dan
-- `authenticated` dicabut, jadi tidak bisa dipanggil lewat /rest/v1/rpc dengan publishable key.

-- Rate limit per kunci (HMAC dari IP) dalam jendela waktu bergeser.
create table public.rate_limit_hits (
  bucket text not null,
  key bytea not null,
  created_at timestamptz not null default now()
);

comment on table public.rate_limit_hits is 'Jejak request untuk rate limit. Baris lebih tua dari jendelanya boleh dihapus.';

create index rate_limit_hits_key_idx on public.rate_limit_hits (bucket, key, created_at);
create index rate_limit_hits_created_idx on public.rate_limit_hits (created_at);

alter table public.rate_limit_hits enable row level security;
revoke all on table public.rate_limit_hits from anon, authenticated;

-- Ambil satu jatah. Mengembalikan 0 kalau diizinkan (dan jatahnya dicatat), atau jumlah detik
-- sampai jatah tertua lepas kalau sudah habis.
create function public.take_rate_limit(
  p_bucket text,
  p_key bytea,
  p_limit integer,
  p_window interval
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  used integer;
  oldest timestamptz;
begin
  -- Request bersamaan dari kunci yang sama diantrekan supaya tidak lolos berbarengan.
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || encode(p_key, 'hex'), 0));

  delete from public.rate_limit_hits
  where bucket = p_bucket and key = p_key and created_at <= now() - p_window;

  select count(*), min(created_at) into used, oldest
  from public.rate_limit_hits
  where bucket = p_bucket and key = p_key;

  if used >= p_limit then
    return greatest(1, ceil(extract(epoch from oldest + p_window - now()))::integer);
  end if;

  insert into public.rate_limit_hits (bucket, key) values (p_bucket, p_key);
  return 0;
end;
$$;

-- Buat draf beserta baris berkasnya dalam satu transaksi. `p_assets` adalah array objek
-- {kind, key, storage_path, mime, size, width, height}.
create function public.create_letter(
  p_id uuid,
  p_design jsonb,
  p_content jsonb,
  p_edit_token_hash bytea,
  p_reply_to_id uuid,
  p_assets jsonb
)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  expires timestamptz;
begin
  insert into public.letters (id, design, content, edit_token_hash, reply_to_id)
  values (p_id, p_design, p_content, p_edit_token_hash, p_reply_to_id)
  returning draft_expires_at into expires;

  insert into public.letter_assets (letter_id, kind, key, storage_path, mime, size, width, height)
  select p_id, a.kind, a.key, a.storage_path, a.mime, a.size, a.width, a.height
  from jsonb_to_recordset(p_assets)
    as a (kind text, key text, storage_path text, mime text, size integer, width integer, height integer);

  return expires;
end;
$$;

-- Terbitkan draf setelah semua berkasnya dicek di Storage. `p_sizes` memetakan storage_path ke
-- ukuran akhir (setelah EXIF dibuang). Tidak mengembalikan baris kalau surat bukan draf lagi,
-- misalnya karena publish lain menang duluan.
create function public.publish_letter(p_id uuid, p_slug text, p_sizes jsonb)
returns setof public.letters
language plpgsql
set search_path = ''
as $$
begin
  return query
    update public.letters
    set status = 'sent', slug = p_slug, published_at = now(), expires_at = now() + interval '30 days'
    where id = p_id and status = 'draft'
    returning *;

  if found then
    update public.letter_assets
    set uploaded_at = now(), size = coalesce((p_sizes ->> storage_path)::integer, size)
    where letter_id = p_id;
  end if;
end;
$$;

-- Tandai surat dibuka. Idempoten: hanya panggilan pertama yang mengisi opened_at.
create function public.open_letter(p_slug text)
returns setof public.letters
language plpgsql
set search_path = ''
as $$
begin
  update public.letters
  set opened_at = now(), photos_expire_at = least(now() + interval '7 days', expires_at)
  where slug = p_slug and status = 'sent' and expires_at > now() and opened_at is null;

  return query
    select * from public.letters
    where slug = p_slug and status = 'sent' and expires_at > now();
end;
$$;

revoke execute on function
  public.take_rate_limit(text, bytea, integer, interval),
  public.create_letter(uuid, jsonb, jsonb, bytea, uuid, jsonb),
  public.publish_letter(uuid, text, jsonb),
  public.open_letter(text)
from public, anon, authenticated;
