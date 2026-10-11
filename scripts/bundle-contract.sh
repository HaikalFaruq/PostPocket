#!/usr/bin/env bash
# Bundel docs/api/openapi.yaml jadi JSON untuk validasi di Edge Functions.
# Jalankan setiap kali kontrak berubah; CI menolak kalau hasilnya beda dengan yang di-commit.
set -euo pipefail
cd "$(dirname "$0")/.."
REDOCLY_SUPPRESS_UPDATE_NOTICE=true npx --yes @redocly/cli@1 bundle docs/api/openapi.yaml --ext json \
  -o supabase/functions/_shared/openapi.json >/dev/null
