-- Kotak bareng (kontrak 0.3.0, docs/backend.md bagian Rancangan kotak bareng): banyak pengirim,
-- satu penerima. Surat titipan adalah surat biasa di letters dengan box_id, jadi validasi,
-- unggah, EXIF, dan pembersihan berkas tetap satu jalur.
--
-- Seperti letters, semua akses lewat Edge Functions dengan secret key: RLS tanpa policy, hak
-- anon dan authenticated dicabut.

create table public.boxes (
  id uuid primary key default gen_random_uuid(),
  -- Link buka untuk penerima (/k/{slug}).
  slug text not null unique check (slug ~ '^[A-Za-z0-9]{10}$'),
  -- Link titip untuk teman-teman (/titip/{invite}). Pemegangnya hanya bisa menitip surat.
  invite text not null unique check (invite ~ '^[A-Za-z0-9]{12}$'),
  edit_token_hash bytea not null check (octet_length(edit_token_hash) = 32),
  -- BoxText: 1-40 code point, satu baris, sudah dipangkas Edge Function.
  title text not null check (
    char_length(title) between 1 and 40 and title !~ '[\r\n]' and title !~ '^\s|\s$'
  ),
  -- `to` di kontrak.
  recipient text not null check (
    char_length(recipient) between 1 and 40 and recipient !~ '[\r\n]' and recipient !~ '^\s|\s$'
  ),
  -- Id seni folder di packages/presets/kotak.json; isinya dicek Edge Function.
  design text not null check (design ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- false: dibuka manual oleh pembuatnya, opens_at hanya batas akhirnya.
  scheduled boolean not null,
  created_at timestamptz not null default now(),
  -- Terbuka untuk penerima dan tertutup untuk titipan.
  opens_at timestamptz not null,
  -- opens_at + 30 hari: kotak dan semua titipannya dihapus. Bukan kolom generated, karena
  -- timestamptz + interval tidak immutable.
  expires_at timestamptz not null,
  opened_at timestamptz,
  -- least(opened_at + 7 hari, expires_at): foto dan cover semua titipan dihapus.
  photos_expire_at timestamptz,
  photos_deleted_at timestamptz,

  constraint boxes_opens_window check (opens_at <= created_at + interval '30 days'),
  constraint boxes_expiry check (expires_at = opens_at + interval '30 days'),
  constraint boxes_opened check (
    (opened_at is null and photos_expire_at is null and photos_deleted_at is null)
    or (opened_at is not null and opened_at >= opens_at and photos_expire_at is not null
      and photos_expire_at <= expires_at)
  )
);

comment on table public.boxes is 'Kotak bareng. Diakses hanya lewat Edge Functions (secret key).';

create index boxes_expiry_idx on public.boxes (expires_at);

alter table public.boxes enable row level security;
revoke all on table public.boxes from anon, authenticated;

-- Surat titipan: box_id dan from_name selalu berpasangan, tanpa balasan.
alter table public.letters
  add column box_id uuid references public.boxes (id) on delete restrict,
  add column from_name text check (
    char_length(from_name) between 1 and 40 and from_name !~ '[\r\n]' and from_name !~ '^\s|\s$'
  ),
  add constraint letters_box_pair check ((box_id is null) = (from_name is null)),
  add constraint letters_box_no_reply check (box_id is null or reply_to_id is null);

create index letters_box_idx on public.letters (box_id) where box_id is not null;

-- Analitik: titipan tidak dihitung created/opened (tidak pernah dibuka satu per satu), tapi
-- punya jenis sendiri. box_opened mencatat jam penuh sejak kotak terbuka (opens_at).
alter table public.letter_events
  drop constraint letter_events_kind_check,
  add constraint letter_events_kind_check check (
    kind in ('created', 'opened', 'replied', 'box_created', 'box_letter', 'box_opened')
  ),
  drop constraint letter_events_after_hours,
  add constraint letter_events_after_hours check (
    (kind in ('created', 'box_created', 'box_letter') and after_hours is null)
    or (kind in ('opened', 'box_opened') and after_hours is not null)
    or kind = 'replied'
  );

create or replace function public.record_letter_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.box_id is not null then
    if old.status = 'draft' and new.status = 'sent' then
      insert into public.letter_events (kind) values ('box_letter');
    end if;
    return null;
  end if;

  if old.status = 'draft' and new.status = 'sent' then
    insert into public.letter_events (kind) values ('created');
    if new.reply_to_id is not null then
      insert into public.letter_events (kind, after_hours)
      values ('replied', (
        select greatest(0, floor(extract(epoch from new.published_at - parent.published_at) / 3600))::integer
        from public.letters parent
        where parent.id = new.reply_to_id
      ));
    end if;
  end if;

  if old.opened_at is null and new.opened_at is not null then
    insert into public.letter_events (kind, after_hours)
    values ('opened', greatest(0, floor(extract(epoch from new.opened_at - new.published_at) / 3600))::integer);
  end if;

  return null;
end;
$$;

create function public.record_box_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.letter_events (kind) values ('box_created');
  elsif old.opened_at is null and new.opened_at is not null then
    insert into public.letter_events (kind, after_hours)
    values ('box_opened', greatest(0, floor(extract(epoch from new.opened_at - new.opens_at) / 3600))::integer);
  end if;
  return null;
end;
$$;

revoke execute on function public.record_box_event() from public, anon, authenticated;

create trigger boxes_record_event
after insert or update of opened_at on public.boxes
for each row execute function public.record_box_event();

-- Catatan error untuk fungsi boxes dan k.
alter table public.function_errors
  drop constraint function_errors_function_check,
  add constraint function_errors_function_check check (
    function in ('letters', 'l', 'cleanup', 'boxes', 'k')
  ),
  drop constraint function_errors_route_check,
  add constraint function_errors_route_check check (route in (
    '/letters', '/letters/:id', '/letters/:id/publish', '/l/:slug', '/l/:slug/open', '/cleanup',
    '/boxes', '/boxes/:id', '/boxes/:id/letters/:letterId', '/boxes/invite/:invite', '/k/:slug',
    '/k/:slug/open', '/:other'
  ));

-- create_letter menerima kotak tujuan. Parameter baru punya default, jadi Edge Function lama
-- yang memanggil dengan enam argumen tetap jalan selama deploy.
drop function public.create_letter(uuid, jsonb, jsonb, bytea, uuid, jsonb);

create function public.create_letter(
  p_id uuid,
  p_design jsonb,
  p_content jsonb,
  p_edit_token_hash bytea,
  p_reply_to_id uuid,
  p_assets jsonb,
  p_box_id uuid default null,
  p_from_name text default null
)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  expires timestamptz;
begin
  insert into public.letters (id, design, content, edit_token_hash, reply_to_id, box_id, from_name)
  values (p_id, p_design, p_content, p_edit_token_hash, p_reply_to_id, p_box_id, p_from_name)
  returning draft_expires_at into expires;

  insert into public.letter_assets (letter_id, kind, key, storage_path, mime, size, width, height)
  select p_id, a.kind, a.key, a.storage_path, a.mime, a.size, a.width, a.height
  from jsonb_to_recordset(p_assets)
    as a (kind text, key text, storage_path text, mime text, size integer, width integer, height integer);

  return expires;
end;
$$;

-- Publish surat titipan mengunci baris kotaknya, jadi dua titipan yang terbit bersamaan tidak
-- bisa sama-sama lolos di batas terakhir. Batasnya dikirim Edge Function (BOX_LIMITS), dengan
-- default yang sama untuk pemanggil lama. Error kotak memakai kode P0001 dengan pesan berupa kode
-- error kontrak (box_closed, box_full).
drop function public.publish_letter(uuid, text, jsonb);

create function public.publish_letter(
  p_id uuid,
  p_slug text,
  p_sizes jsonb,
  p_max_letters integer default 20,
  p_max_photos integer default 40
)
returns setof public.letters
language plpgsql
set search_path = ''
as $$
declare
  target_box uuid;
  box public.boxes;
  used_letters integer;
  used_photos integer;
  own_photos integer;
  expires timestamptz := now() + interval '30 days';
begin
  select box_id into target_box from public.letters where id = p_id and status = 'draft';

  if target_box is not null then
    select * into box from public.boxes where id = target_box for update;
    if box.opens_at <= now() then
      raise exception 'box_closed' using errcode = 'P0001';
    end if;
    select count(*) into used_letters
    from public.letters where box_id = target_box and status = 'sent';
    select count(*) into used_photos
    from public.letter_assets a join public.letters l on l.id = a.letter_id
    where l.box_id = target_box and l.status = 'sent' and a.kind in ('photo', 'cover');
    select count(*) into own_photos
    from public.letter_assets where letter_id = p_id and kind in ('photo', 'cover');
    if used_letters + 1 > p_max_letters or used_photos + own_photos > p_max_photos then
      raise exception 'box_full' using errcode = 'P0001';
    end if;
    expires := box.expires_at;
  end if;

  return query
    update public.letters
    set status = 'sent', slug = p_slug, published_at = now(), expires_at = expires
    where id = p_id and status = 'draft'
    returning *;

  if found then
    update public.letter_assets
    set uploaded_at = now(), size = coalesce((p_sizes ->> storage_path)::integer, size)
    where letter_id = p_id;
  end if;
end;
$$;

-- Surat titipan tidak bisa dibuka lewat /l/{slug}; isinya hanya lewat /k/{slug} kotaknya.
create or replace function public.open_letter(p_slug text)
returns setof public.letters
language plpgsql
set search_path = ''
as $$
begin
  update public.letters
  set opened_at = now(), photos_expire_at = least(now() + interval '7 days', expires_at)
  where slug = p_slug and status = 'sent' and box_id is null and expires_at > now()
    and opened_at is null;

  return query
    select * from public.letters
    where slug = p_slug and status = 'sent' and box_id is null and expires_at > now();
end;
$$;

-- Buat kotak. p_opens_at null berarti dibuka manual (batas akhirnya 30 hari lagi). Slug atau
-- invite yang bentrok (sangat jarang) dijawab 23505 dan dicoba ulang Edge Function.
create function public.create_box(
  p_slug text,
  p_invite text,
  p_edit_token_hash bytea,
  p_title text,
  p_recipient text,
  p_design text,
  p_opens_at timestamptz
)
returns setof public.boxes
language plpgsql
set search_path = ''
as $$
declare
  opens timestamptz := coalesce(p_opens_at, now() + interval '30 days');
begin
  if p_opens_at is not null and (p_opens_at <= now() or p_opens_at > now() + interval '30 days') then
    raise exception 'invalid_box' using errcode = 'P0001';
  end if;

  return query
    insert into public.boxes (
      slug, invite, edit_token_hash, title, recipient, design, scheduled, opens_at, expires_at
    )
    values (
      p_slug, p_invite, p_edit_token_hash, p_title, p_recipient, p_design, p_opens_at is not null,
      opens, opens + interval '30 days'
    )
    returning *;
end;
$$;

-- Ubah kotak selama belum terbuka. p_patch berisi field UpdateBoxRequest yang sudah dicek dan
-- dipangkas Edge Function: title, to, design, opensAt (boleh null), openNow. Semua waktu memakai
-- jam server. Kalau opens_at berubah, expires_at surat titipannya ikut berubah.
create function public.update_box(p_id uuid, p_patch jsonb)
returns setof public.boxes
language plpgsql
set search_path = ''
as $$
declare
  box public.boxes;
  opens timestamptz;
  is_scheduled boolean;
  wanted timestamptz;
begin
  select * into box from public.boxes where id = p_id and expires_at > now() for update;
  if not found then
    return;
  end if;
  if box.opens_at <= now() then
    raise exception 'box_closed' using errcode = 'P0001';
  end if;
  if p_patch ? 'openNow' and p_patch ? 'opensAt' then
    raise exception 'invalid_box' using errcode = 'P0001';
  end if;

  opens := box.opens_at;
  is_scheduled := box.scheduled;
  if p_patch ? 'openNow' then
    opens := now();
    is_scheduled := true;
  elsif p_patch ? 'opensAt' then
    if jsonb_typeof(p_patch -> 'opensAt') = 'null' then
      opens := box.created_at + interval '30 days';
      is_scheduled := false;
    else
      wanted := (p_patch ->> 'opensAt')::timestamptz;
      if wanted <= now() or wanted > box.created_at + interval '30 days' then
        raise exception 'invalid_box' using errcode = 'P0001';
      end if;
      opens := wanted;
      is_scheduled := true;
    end if;
  end if;

  update public.boxes
  set title = coalesce(p_patch ->> 'title', title),
    recipient = coalesce(p_patch ->> 'to', recipient),
    design = coalesce(p_patch ->> 'design', design),
    opens_at = opens,
    scheduled = is_scheduled,
    expires_at = opens + interval '30 days'
  where id = p_id;

  if opens is distinct from box.opens_at then
    update public.letters
    set expires_at = opens + interval '30 days'
    where box_id = p_id and status = 'sent';
  end if;

  return query select * from public.boxes where id = p_id;
end;
$$;

-- Tandai kotak dibuka. Idempoten: hanya panggilan pertama setelah opens_at yang mengisi
-- opened_at, dan jadwal hapus foto ikut diisi di semua titipannya, jadi jalur foto surat yang
-- sudah ada menghapusnya. Mengembalikan kotaknya (juga sebelum opens_at, supaya Edge Function
-- bisa menjawab box_not_open), atau tidak ada baris kalau kotaknya tidak ada.
create function public.open_box(p_slug text)
returns setof public.boxes
language plpgsql
set search_path = ''
as $$
declare
  opened public.boxes;
begin
  update public.boxes
  set opened_at = now(), photos_expire_at = least(now() + interval '7 days', expires_at)
  where slug = p_slug and expires_at > now() and opens_at <= now() and opened_at is null
  returning * into opened;

  if found then
    update public.letters
    set opened_at = opened.opened_at, photos_expire_at = opened.photos_expire_at
    where box_id = opened.id and status = 'sent' and opened_at is null;
  end if;

  return query select * from public.boxes where slug = p_slug and expires_at > now();
end;
$$;

revoke execute on function
  public.create_letter(uuid, jsonb, jsonb, bytea, uuid, jsonb, uuid, text),
  public.publish_letter(uuid, text, jsonb, integer, integer),
  public.create_box(text, text, bytea, text, text, text, timestamptz),
  public.update_box(uuid, jsonb),
  public.open_box(text)
from public, anon, authenticated;

-- run_cleanup: boxes.photos_deleted_at diisi begitu foto semua titipannya sudah dihapus job.
create or replace function public.run_cleanup()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  token text;
begin
  -- Jendela rate limit terpanjang di Edge Functions adalah 1 jam (RATE_LIMIT di letters).
  delete from public.rate_limit_hits where created_at < now() - interval '1 hour';
  delete from public.letter_events where occurred_at < now() - interval '13 months';
  delete from public.function_errors where occurred_at < now() - interval '30 days';

  -- Baris fase 2 berstatus hapus disimpan 30 hari supaya sampai ke perangkat lain lewat sinkron.
  -- Momen baru dibuang kalau berkasnya sudah tidak ada, supaya berkasnya tetap dikenali sampah.
  delete from public.pockets where deleted_at < now() - interval '30 days';
  delete from public.albums where deleted_at < now() - interval '30 days';
  delete from public.moments m
  where m.deleted_at < now() - interval '30 days'
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'moments'
        and o.name = public.moment_file_path(m.owner_id, m.id, m.mime)
    );

  update public.boxes b
  set photos_deleted_at = now()
  where b.photos_expire_at <= now() and b.photos_deleted_at is null
    and not exists (
      select 1 from public.letters l
      where l.box_id = b.id and l.status = 'sent' and l.photos_deleted_at is null
    );

  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  if base_url is null then
    raise notice 'project_url belum ada di Vault, Edge Function cleanup tidak dipanggil';
    return null;
  end if;
  select decrypted_secret into token from vault.decrypted_secrets where name = 'cleanup_token';

  return net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/cleanup',
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-cleanup-token', token),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.run_cleanup() from public, anon, authenticated;
