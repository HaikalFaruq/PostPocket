-- Event analitik dan catatan error Edge Functions (docs/backend.md, bagian Analitik dan
-- monitoring error).
--
-- Keduanya tanpa data pribadi: tidak ada letter_id, slug, IP, user agent, cookie, isi surat,
-- atau pesan error. Hanya secret key dan SQL di dashboard yang bisa membacanya; view memakai
-- security_invoker supaya RLS tabelnya tidak dilewati.

-- Event: surat dibuat (publish), dibuka (pertama kali), dan dibalas (balasan di-publish).
create table public.letter_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('created', 'opened', 'replied')),
  -- Dibulatkan ke jam supaya tidak sama persis dengan published_at atau opened_at suratnya.
  occurred_at timestamptz not null default date_trunc('hour', now(), 'UTC'),
  -- Jam penuh sejak surat (untuk replied: surat yang dibalas) di-publish. Kosong untuk created,
  -- dan untuk replied kalau surat yang dibalas sudah terhapus.
  after_hours integer check (after_hours >= 0),
  constraint letter_events_after_hours check (
    (kind = 'created' and after_hours is null)
    or (kind = 'opened' and after_hours is not null)
    or kind = 'replied'
  ),
  constraint letter_events_hour check (occurred_at = date_trunc('hour', occurred_at, 'UTC'))
);

comment on table public.letter_events is 'Event analitik tanpa data pribadi. Diisi trigger di letters.';

create index letter_events_occurred_idx on public.letter_events (occurred_at);

alter table public.letter_events enable row level security;
revoke all on table public.letter_events from anon, authenticated;

create function public.record_letter_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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

create trigger letters_record_event
after update of status, opened_at on public.letters
for each row execute function public.record_letter_event();

-- Error 5xx dari kode Edge Functions. Nama dan kode error saja: pesannya bisa membawa URL berisi
-- slug atau nilai input. Pola di constraint menahan apa pun yang lolos dari saringan di fungsi.
create table public.function_errors (
  id bigint generated always as identity primary key,
  function text not null check (function in ('letters', 'l', 'cleanup')),
  -- Pola route, bukan path aslinya. Daftar tetap supaya slug huruf kecil pun tidak bisa masuk.
  route text not null check (route in (
    '/letters', '/letters/:id', '/letters/:id/publish', '/l/:slug', '/l/:slug/open', '/cleanup', '/:other'
  )),
  status smallint not null check (status between 500 and 599),
  error_name text check (error_name ~ '^[A-Za-z0-9_]{1,60}$'),
  error_code text check (error_code ~ '^[A-Za-z0-9_]{1,20}$'),
  occurred_at timestamptz not null default now()
);

comment on table public.function_errors is 'Error 5xx Edge Functions tanpa pesan, header, body, atau IP. Disimpan 30 hari.';

create index function_errors_occurred_idx on public.function_errors (occurred_at);

alter table public.function_errors enable row level security;
revoke all on table public.function_errors from anon, authenticated;

-- Ringkasan untuk dibaca di dashboard, per minggu dan per hari WIB.
create view public.letter_stats_weekly
with (security_invoker = true)
as
select
  date_trunc('week', occurred_at at time zone 'Asia/Jakarta')::date as week,
  kind,
  count(*) as total,
  percentile_cont(0.5) within group (order by after_hours) as median_after_hours
from public.letter_events
group by 1, 2;

create view public.function_errors_daily
with (security_invoker = true)
as
select
  (occurred_at at time zone 'Asia/Jakarta')::date as day,
  function,
  route,
  status,
  error_name,
  error_code,
  count(*) as total
from public.function_errors
group by 1, 2, 3, 4, 5, 6;

revoke all on public.letter_stats_weekly, public.function_errors_daily from anon, authenticated;

revoke execute on function public.record_letter_event() from public, anon, authenticated;

-- run_cleanup() ikut membuang event lebih tua dari 13 bulan dan error lebih tua dari 30 hari.
-- Isinya sama dengan versi di migrasi cleanup_job, plus dua delete di awal.
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
