#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: restore-inline-media-from-trash.sh [--dry-run|--apply] [--prod-dir /srv/jant]

Restore first-party inline media that still has an unexpired storage_purge trash
object. Dry-run is the default and performs only read-only checks.

The script is intended to run on the production host. It reads:
  - /srv/jant/.env for DATABASE_URL and S3 credentials
  - the postgres-postgres-1 Docker container for psql
  - aws s3api for storage head/copy operations
EOF
}

mode="dry-run"
prod_dir="/srv/jant"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      mode="dry-run"
      shift
      ;;
    --apply)
      mode="apply"
      shift
      ;;
    --prod-dir)
      prod_dir="${2:-}"
      if [[ -z "$prod_dir" ]]; then
        echo "--prod-dir requires a value" >&2
        exit 2
      fi
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$mode" != "dry-run" && "$mode" != "apply" ]]; then
  echo "Invalid mode: $mode" >&2
  exit 2
fi

if [[ ! -f "$prod_dir/.env" ]]; then
  echo "Missing env file: $prod_dir/.env" >&2
  exit 2
fi

cd "$prod_dir"
set -a
# shellcheck source=/dev/null
. "$prod_dir/.env"
set +a

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="${S3_REGION:-auto}"

psql_prod() {
  docker exec -i postgres-postgres-1 psql "$DATABASE_URL" \
    -v ON_ERROR_STOP=1 \
    -P pager=off \
    "$@"
}

now_epoch() {
  date +%s
}

mime_from_key() {
  local key="$1"
  case "${key##*.}" in
    avif) printf "image/avif" ;;
    gif) printf "image/gif" ;;
    jpg | jpeg) printf "image/jpeg" ;;
    png) printf "image/png" ;;
    svg) printf "image/svg+xml" ;;
    webp) printf "image/webp" ;;
    *) printf "application/octet-stream" ;;
  esac
}

candidates_file="$(mktemp)"
manifest_file="$(mktemp)"
summary_file="$(mktemp)"
cleanup() {
  rm -f "$candidates_file" "$manifest_file" "$summary_file"
}
trap cleanup EXIT

psql_prod -F $'\t' -At >"$candidates_file" <<'SQL'
with refs as (
  select distinct
    p.site_id as post_site_id,
    p.id as post_id,
    m[1] as ref_site_id,
    m[2] as media_id,
    m[3] as ext,
    'media/' || m[1] || '/files/' || m[2] || '.' || m[3] as original_key
  from post p
  cross join lateral regexp_matches(
    coalesce(p.body,'') || ' ' || coalesce(p.body_html,'') || ' ' || coalesce(p.body_text,''),
    'media/(sit_[0-9a-z]+)/files/(med_[0-9a-z]+)\.([A-Za-z0-9]+)',
    'g'
  ) as m
),
primary_domain as (
  select distinct on (site_id) site_id, host
  from site_domain
  order by site_id, case kind when 'primary' then 0 when 'jant' then 1 else 2 end, host
)
select
  coalesce(pd.host, r.post_site_id) as host,
  r.post_id,
  r.ref_site_id,
  r.media_id,
  r.original_key,
  sp.storage_key as trash_key,
  sp.provider,
  sp.purge_after
from refs r
join storage_purge sp
  on sp.site_id = r.ref_site_id
 and sp.original_key = r.original_key
left join media med
  on med.site_id = r.ref_site_id
 and med.id = r.media_id
left join primary_domain pd
  on pd.site_id = r.post_site_id
where med.id is null
  and sp.purge_after > extract(epoch from now())::int
order by host, r.post_id, r.media_id;
SQL

candidate_count="$(wc -l <"$candidates_file" | tr -d ' ')"
printf "Mode: %s\n" "$mode"
printf "Recoverable DB candidates: %s\n" "$candidate_count"

if [[ "$candidate_count" == "0" ]]; then
  exit 0
fi

restorable=0
copied=0
already_original=0
missing_trash=0
copy_failed=0
skipped=0

while IFS=$'\t' read -r host post_id site_id media_id original_key trash_key provider purge_after; do
  if [[ -z "$host" || -z "$site_id" || -z "$media_id" || -z "$original_key" || -z "$trash_key" ]]; then
    skipped=$((skipped + 1))
    printf "%s\t%s\t%s\t%s\n" "${host:-unknown}" "${media_id:-unknown}" "skipped" "incomplete-candidate" >>"$summary_file"
    continue
  fi

  if ! head_output="$(
    aws s3api head-object \
      --endpoint-url "$S3_ENDPOINT" \
      --bucket "$S3_BUCKET" \
      --key "$trash_key" \
      --query '[ContentLength,ContentType]' \
      --output text 2>/dev/null
  )"; then
    missing_trash=$((missing_trash + 1))
    printf "%s\t%s\t%s\t%s\n" "$host" "$media_id" "missing-trash" "$trash_key" >>"$summary_file"
    continue
  fi

  size="$(awk '{print $1}' <<<"$head_output")"
  content_type="$(cut -f2- <<<"$head_output")"
  if [[ -z "$size" || "$size" == "None" ]]; then
    skipped=$((skipped + 1))
    printf "%s\t%s\t%s\t%s\n" "$host" "$media_id" "skipped" "missing-size" >>"$summary_file"
    continue
  fi
  if [[ -z "$content_type" || "$content_type" == "None" ]]; then
    content_type="$(mime_from_key "$original_key")"
  fi

  original_exists="false"
  if aws s3api head-object \
    --endpoint-url "$S3_ENDPOINT" \
    --bucket "$S3_BUCKET" \
    --key "$original_key" >/dev/null 2>&1; then
    original_exists="true"
    already_original=$((already_original + 1))
  fi

  if [[ "$mode" == "apply" && "$original_exists" == "false" ]]; then
    if aws s3api copy-object \
      --endpoint-url "$S3_ENDPOINT" \
      --bucket "$S3_BUCKET" \
      --copy-source "$S3_BUCKET/$trash_key" \
      --key "$original_key" >/dev/null; then
      copied=$((copied + 1))
      original_exists="true"
    else
      copy_failed=$((copy_failed + 1))
      printf "%s\t%s\t%s\t%s\n" "$host" "$media_id" "copy-failed" "$trash_key" >>"$summary_file"
      continue
    fi
  fi

  restorable=$((restorable + 1))
  restored_at="$(now_epoch)"
  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
    "$site_id" \
    "$media_id" \
    "$original_key" \
    "$provider" \
    "$content_type" \
    "$size" \
    "$restored_at" >>"$manifest_file"
  printf "%s\t%s\t%s\t%s\n" "$host" "$media_id" "ready" "$original_key" >>"$summary_file"
done <"$candidates_file"

printf "\nObject check summary:\n"
printf "  ready: %s\n" "$restorable"
printf "  original already existed: %s\n" "$already_original"
printf "  copied from trash: %s\n" "$copied"
printf "  missing trash: %s\n" "$missing_trash"
printf "  copy failed: %s\n" "$copy_failed"
printf "  skipped: %s\n" "$skipped"

printf "\nReady by site:\n"
awk -F '\t' '$3 == "ready" { count[$1]++ } END { for (site in count) print site "\t" count[site] }' "$summary_file" | sort

if [[ "$mode" == "dry-run" ]]; then
  printf "\nDry-run only. Re-run with --apply to copy objects and recreate media rows.\n"
  exit 0
fi

if [[ "$restorable" == "0" ]]; then
  echo "No restorable rows after object checks."
  exit 1
fi

{
  cat <<'SQL'
begin;
create temp table tmp_restore_inline_media (
  site_id text not null,
  media_id text not null,
  original_key text not null,
  provider text not null,
  content_type text not null,
  size integer not null,
  restored_at integer not null
) on commit drop;
copy tmp_restore_inline_media (
  site_id,
  media_id,
  original_key,
  provider,
  content_type,
  size,
  restored_at
) from stdin with (format text, delimiter E'\t', null '');
SQL
  cat "$manifest_file"
  printf "\\.\n"
  cat <<'SQL'
with prepared as (
  select
    t.site_id,
    t.media_id,
    t.original_key,
    t.provider,
    coalesce(nullif(us.filename, ''), regexp_replace(t.original_key, '^.*/', '')) as filename,
    coalesce(nullif(us.original_name, ''), nullif(us.filename, ''), regexp_replace(t.original_key, '^.*/', '')) as original_name,
    coalesce(nullif(us.expected_content_type, ''), t.content_type) as mime_type,
    coalesce(us.expected_size, t.size) as size,
    coalesce(us.created_at, t.restored_at) as created_at,
    coalesce(us.updated_at, t.restored_at) as updated_at
  from tmp_restore_inline_media t
  left join upload_session us
    on us.site_id = t.site_id
   and us.media_id = t.media_id
)
insert into media (
  id,
  site_id,
  post_id,
  filename,
  original_name,
  mime_type,
  size,
  storage_key,
  provider,
  position,
  media_kind,
  created_at,
  updated_at
)
select
  media_id,
  site_id,
  null,
  filename,
  original_name,
  mime_type,
  size,
  original_key,
  provider,
  'a0',
  'image',
  created_at,
  updated_at
from prepared
where not exists (
  select 1
  from media m
  where m.site_id = prepared.site_id
    and m.id = prepared.media_id
)
on conflict do nothing;

select 'inserted_media_rows', count(*)
from media m
join tmp_restore_inline_media t
  on t.site_id = m.site_id
 and t.media_id = m.id;

commit;
SQL
} | psql_prod -F $'\t' -At

printf "\nApply complete. Verify public media URLs before notifying users.\n"
