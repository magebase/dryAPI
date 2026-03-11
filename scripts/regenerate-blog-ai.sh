#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-22}"
created=0
attempt=0

auth_args=()
if [[ -n "${BLOG_GENERATOR_SECRET:-}" ]]; then
  auth_args=(-H "authorization: Bearer ${BLOG_GENERATOR_SECRET}")
fi

for _ in $(seq 1 250); do
  attempt=$((attempt+1))
  resp=$(curl -sS --max-time 180 -X POST "http://127.0.0.1:3000/api/blog/generate" \
    -H "content-type: application/json" \
    "${auth_args[@]}" \
    -d '{"provider":"gemini","model":"gemini-2.5-flash","count":1}')

  summary=$(node -e 'const p=JSON.parse(process.argv[1]);const c=(p.created&&p.created[0])||{};console.log(JSON.stringify({ok:p.ok,createdCount:p.createdCount||0,fallbackCount:p.fallbackCount||0,slug:c.slug||null,error:(p.errors&&p.errors[0]&&p.errors[0].error)||null}));' "$resp")
  ok=$(node -e 'const s=JSON.parse(process.argv[1]);process.stdout.write(String(s.createdCount===1 && s.fallbackCount===0));' "$summary")
  slug=$(node -e 'const s=JSON.parse(process.argv[1]);process.stdout.write(String(s.slug||""));' "$summary")

  if [[ "$ok" == "true" ]]; then
    created=$((created+1))
    echo "created_ai=${created}/${TARGET} slug=${slug}"
  else
    echo "retry_needed attempt=${attempt} details=${summary}"
    if [[ -n "$slug" && -f "content/blog/${slug}.json" ]]; then
      rm -f "content/blog/${slug}.json"
      echo "removed_fallback_slug=${slug}"
    fi
    sleep 35
  fi

  if (( created >= TARGET )); then
    break
  fi
done

if (( created < TARGET )); then
  echo "Failed to generate required AI posts: created=${created} target=${TARGET}" >&2
  exit 2
fi

printf 'final_blog_file_count=%s\n' "$(ls content/blog/*.json 2>/dev/null | wc -l)"
