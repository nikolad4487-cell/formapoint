#!/usr/bin/env bash
set -euo pipefail
# Službeni CLI, pin i provjera službenog SHA-256; bez izmjene globalnog HOME-a.
cli_version=2.54.11
tools_dir="${FORMAPOINT_TOOLS_DIR:-/workspace/.tools/formapoint}"
if [[ -x "$tools_dir/supabase" ]] && [[ "$("$tools_dir/supabase" --version 2>/dev/null)" == "$cli_version" ]]; then exit 0; fi
case "$(uname -m)" in x86_64) cli_arch=amd64;; aarch64|arm64) cli_arch=arm64;; *) echo 'Nepodržana arhitektura.' >&2; exit 1;; esac
[[ "$(uname -s)" == Linux ]] || { echo 'Ova skripta namijenjena je Linuxu.' >&2; exit 1; }
cli_tmp="$(mktemp -d)"
trap 'rm -rf "$cli_tmp"' EXIT
archive="supabase_linux_${cli_arch}.tar.gz"
curl --fail --location --silent --show-error "https://github.com/supabase/cli/releases/download/v${cli_version}/supabase_${cli_version}_checksums.txt" -o "$cli_tmp/checksums.txt"
curl --fail --location --silent --show-error "https://github.com/supabase/cli/releases/download/v${cli_version}/$archive" -o "$cli_tmp/$archive"
awk -v name="$archive" '$2 == name {print}' "$cli_tmp/checksums.txt" > "$cli_tmp/verify.txt"
(cd "$cli_tmp" && test -s verify.txt && sha256sum --check verify.txt)
mkdir -p "$tools_dir"
tar -xzf "$cli_tmp/$archive" -C "$tools_dir" supabase
