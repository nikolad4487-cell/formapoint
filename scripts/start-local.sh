#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/install-supabase-cli.sh
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io /workspace/.tools/formapoint/supabase start --exclude studio,imgproxy,logflare,vector,supavisor,postgres-meta > /tmp/formapoint-supabase-start.log 2>&1 || { echo 'Pokretanje Supabasea nije uspjelo. Log je u /tmp/formapoint-supabase-start.log; može sadržavati lokalne ključeve i ne smije se javno objaviti.' >&2; exit 1; }
node scripts/configure-local.mjs
printf 'Lokalni Supabase je pokrenut. Zasebno pokrenite npm run dev i npm run backend:functions.\n'
