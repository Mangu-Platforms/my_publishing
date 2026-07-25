#!/usr/bin/env bash
#
# Phoenix P11.1 — EXPORT from Supabase Postgres to export/*.json
#
# Human gate: requires SUPABASE_DB_URL (the direct Postgres connection string,
# Supabase dashboard → Project Settings → Database → Connection string → URI).
# The agent never holds this credential; see HUMAN_TASKS.md P11.1.
#
# Usage:
#   export SUPABASE_DB_URL='postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres'
#   ./scripts/export-supabase.sh
#
# Output: export/*.json — each a JSON array, always valid, `[]` when the table is
# empty. Feed straight into `npm run phoenix:transform` (P11.2).
#
# Deviations from PROJECT_PHOENIX.md §5.5 P11.1, all verified against
# supabase/migrations/ (see docs/PROJECT_PHOENIX.md revision 4.0.2):
#
#   1. `\copy (...) TO file` is NOT used. \copy writes PostgreSQL COPY *text
#      format*, which escapes backslashes and newlines inside the value — that
#      corrupts json_agg output into invalid JSON. `psql -At -c` writes the raw
#      scalar instead.
#   2. json_agg returns SQL NULL for an empty table, which lands in the file as
#      an empty string and fails to parse. Wrapped in coalesce(..., '[]').
#   3. The documented orders join selected `oi.quantity` and `oi.price_cents`.
#      Neither column exists: order_items is (id, order_id, book_id, unit_price,
#      license_key, created_at). Quantity is implicit (one row per licensed
#      copy). The order's payment intent column is `payment_intent_id`, not
#      `stripe_payment_intent_id`.
#
set -euo pipefail

OUT_DIR="${OUT_DIR:-export}"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "error: SUPABASE_DB_URL is not set." >&2
  echo "  Supabase dashboard → Project Settings → Database → Connection string → URI" >&2
  exit 1
fi

for bin in psql jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "error: $bin is required but not installed." >&2; exit 1; }
done

mkdir -p "$OUT_DIR"

# Runs a SELECT and writes its single scalar result to $OUT_DIR/$1.json.
#   -A  unaligned output (no column padding)
#   -t  tuples only (no header, no row count)
#   -X  ignore ~/.psqlrc, which could otherwise inject pager or formatting
#   -v ON_ERROR_STOP=1  fail the script on a bad query instead of writing junk
dump() {
  local name="$1" inner="$2"
  printf '  %-18s' "$name"
  psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 \
    -c "SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM ($inner) t" \
    > "$OUT_DIR/$name.json"
  printf 'ok\n'
}

echo
echo "Phoenix P11.1 — exporting Supabase → $OUT_DIR/"
echo

# Better Auth identity source. raw_user_meta_data carries the display name that
# signup wrote; email_confirmed_at becomes user.emailVerified.
dump auth_users "
  SELECT id, email, email_confirmed_at, created_at, updated_at, raw_user_meta_data
  FROM auth.users
  ORDER BY created_at
"

# profiles.user_id is the auth.users FK (the doc called it auth_user_id, which is
# the *Mongo* field name). profiles.id is what orders/reading_progress point at.
dump profiles "SELECT * FROM public.profiles ORDER BY created_at"
dump authors  "SELECT * FROM public.authors  ORDER BY created_at"
dump books    "SELECT * FROM public.books    ORDER BY created_at"

# One row per order line; the transform regroups them into embedded order_items[].
dump orders_raw "
  SELECT o.id            AS order_id,
         o.order_number,
         o.user_id       AS profile_id,
         o.total_amount,
         o.status,
         o.payment_intent_id,
         o.created_at,
         o.updated_at,
         oi.id           AS order_item_id,
         oi.book_id,
         oi.unit_price,
         oi.license_key
  FROM public.orders o
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  ORDER BY o.created_at, oi.created_at
"

# reviews.user_id references auth.users directly (not profiles).
dump reviews "SELECT * FROM public.reviews ORDER BY created_at"

# reading_progress.user_id references profiles(id); the transform remaps it.
dump reading_progress "SELECT * FROM public.reading_progress ORDER BY created_at"

# Manuscript/EPUB locations live in book_content, not on books. WS3.4
# (migrate-storage) rewrites these to Blob URLs after import.
dump book_content "SELECT * FROM public.book_content ORDER BY created_at"

echo
echo "Verification (P11.1: every file parses and is non-empty):"
echo
fail=0
for f in "$OUT_DIR"/*.json; do
  if ! len=$(jq -e 'length' "$f" 2>/dev/null); then
    printf '  %-28s FAIL — does not parse as JSON\n' "$(basename "$f")"
    fail=1
    continue
  fi
  printf '  %-28s %s rows\n' "$(basename "$f")" "$len"
done

echo
if [[ "$fail" -ne 0 ]]; then
  echo "P11.1 FAILED — fix the export before running the transform." >&2
  exit 1
fi
echo "P11.1 complete. Next: npm run phoenix:transform"
