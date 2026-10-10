#!/bin/sh
# Uji scripts/check-secrets.sh. Contoh rahasia palsu dirakit saat jalan, supaya file ini
# sendiri tidak memuat pola rahasia (dan tidak ditolak hook maupun push protection).
#
#   scripts/test-check-secrets.sh
#   CHECK_SH=dash scripts/test-check-secrets.sh

set -eu
check="$(cd "$(dirname "$0")" && pwd)/check-secrets.sh"
sh_cmd=${CHECK_SH:-sh}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
total=0
failed=0

long=$(printf 'x%.0s' $(seq 1 32))
fake_secret="sb_secret""_${long}"
fake_key_header="-----BEGIN"" PRIVATE KEY-----"
fake_service="SUPABASE_SERVICE_ROLE_KEY""=eyJhbGciOiJIUzI1NiJ9.${long}"

# $1 = tolak|lolos, $2 = nama file, $3 = isi
file() {
  total=$((total + 1))
  mkdir -p "$tmp/files"
  printf '%s\n' "$3" > "$tmp/files/$2"
  if "$sh_cmd" "$check" --files "$tmp/files/$2" 2>/dev/null; then got=lolos; else got=tolak; fi
  if [ "$got" != "$1" ]; then
    printf 'SALAH, harusnya %s: %s\n' "$1" "$2" >&2
    failed=$((failed + 1))
  fi
  rm -f "$tmp/files/$2"
}

file tolak config.ts "export const key = '${fake_secret}'"
file tolak id_rsa "${fake_key_header}"
file tolak deploy.sh "${fake_service}"
file tolak .env "NUXT_PUBLIC_SUPABASE_URL=https://contoh.supabase.co"
file tolak .env.local "APAPUN=1"
file lolos .env.example "NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_..."
file lolos nuxt.config.ts "supabasePublishableKey: ''"
file lolos AGENTS.md 'Secret key Supabase (`sb_secret_...`) dan SUPABASE_SERVICE_ROLE_KEY tidak pernah di-commit.'
file lolos client.ts "const key = 'sb_publishable_${long}'"

# Mode --staged di repo git sementara.
staged() {  # $1 = tolak|lolos, $2 = nama file, $3 = isi
  total=$((total + 1))
  (
    cd "$tmp/repo"
    printf '%s\n' "$3" > "$2"
    git add -f "$2"
  )
  if (cd "$tmp/repo" && "$sh_cmd" "$check" --staged 2>/dev/null); then got=lolos; else got=tolak; fi
  if [ "$got" != "$1" ]; then
    printf 'SALAH (staged), harusnya %s: %s\n' "$1" "$2" >&2
    failed=$((failed + 1))
  fi
  (cd "$tmp/repo" && git reset -q && rm -f "$2")
}

git init -q "$tmp/repo"
staged lolos catatan.md "Kartu foil pakai CSS 3D."
staged tolak .env "NUXT_PUBLIC_SUPABASE_URL=https://contoh.supabase.co"
staged tolak "nama berspasi.ts" "const k = '${fake_secret}'"
staged lolos .env.example "NUXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co"

if [ "$failed" -gt 0 ]; then
  printf '%s dari %s contoh salah.\n' "$failed" "$total" >&2
  exit 1
fi
printf 'Semua %s contoh benar.\n' "$total"
