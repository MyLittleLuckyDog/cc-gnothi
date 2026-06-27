#!/usr/bin/env bash
# batch-cached.sh — chain analyze-batch.js across versions with per-ver
# cleanup + hash-based COPY/ANALYZE classification + 4-way parallel
# instances sharing one cache session.
#
# Why this wrapper instead of analyze-all.sh --parallel:
#   * analyze-batch.js (PR #8 / #9) shares one Anthropic client across N
#     commands, so the prompt-cache key stays hot — empirically 80% read
#     hit ratio (PR #9) on a 5-cmd batch.
#   * Running 4 instances with the *same* CC_GNOTHI_SESSION_ID lets the
#     gateway map all of them to the same metadata.user_id, so the cache
#     stays shared. Aligns with claude-gateway's max_concurrent=4 default.
#   * Per-ver cleanup before analysis avoids the SKIP-if-verified gate
#     leaving stale (pre-KNOWN_TYPES) spec rows around.
#
# Usage:
#   ./scripts/batch-cached.sh <start-ver> <end-ver> [parallel=4]
#
# Per-ver pipeline (idempotent against the inject step but not the
# analyze step — running it twice will spend tokens):
#
#   1. extract-ast --build-index   (cached graph; arbor enrichment)
#   2. extract-ast --hash-commands (prev + curr; cached after first run)
#   3. clean a stale general .md   (_*.md untouched)
#   4. classify hashes             (COPY / ANALYZE)
#   5. COPY  prev/cmd.md → curr/   (with cc_version + updated + inherited_from)
#   6. ANALYZE 4-way split         (analyze-batch.js × $PARALLEL)
#   7. inject-spec-fields.js       (Registration table backfill)
#   8. quick validation grep       (bundle_verified, Korean check)

set -uo pipefail

START_VER=${1:?usage: batch-cached.sh <start-ver> <end-ver> [parallel=2]}
END_VER=${2:?}
# parallel=2 default. parallel=4 hit the gateway's max_concurrent ceiling and
# stacked requests behind it long enough to cross the SDK request timeout —
# half of v2.1.139's ANALYZE batch came back as "Request timed out". 2 keeps
# in-flight headroom while still cutting wall time vs single-instance.
PARALLEL=${3:-2}
DEPTH=${DEPTH:-4}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ARTIFACTS_DIR="$(cd "$REPO_ROOT/../claudeCodeAVX2/artifacts" && pwd)"
CACHE_DIR="$HOME/.cc-gnothi/cache"

# Sorted version list filtered to [START..END]
ALL=()
while IFS= read -r v; do
  ALL+=("$v")
done < <(ls "$REPO_ROOT/versions" | sed 's/^v//' | sort -V)

PAIRS=()
for i in $(seq 1 $((${#ALL[@]} - 1))); do
  prev=${ALL[$((i-1))]}
  curr=${ALL[$i]}
  [[ "$(printf '%s\n%s' "$START_VER" "$curr" | sort -V | head -1)" == "$START_VER" ]] || continue
  [[ "$(printf '%s\n%s' "$curr"      "$END_VER" | sort -V | tail -1)" == "$END_VER" ]] || continue
  PAIRS+=("$prev:$curr")
done

if [[ ${#PAIRS[@]} -eq 0 ]]; then
  echo "no pairs in range [$START_VER..$END_VER]" >&2
  exit 1
fi

echo "═══ batch-cached plan ($(date)) ═══"
for p in "${PAIRS[@]}"; do echo "  v${p#*:}  ←  v${p%:*}"; done
echo "  depth=$DEPTH parallel=$PARALLEL session-id=cc-gnothi-batch-{curr}"
echo "═════════════════════════════════════════"

t0=$(date +%s)

for p in "${PAIRS[@]}"; do
  prev=${p%:*}
  curr=${p#*:}
  bundle="$ARTIFACTS_DIR/claude-${curr}.js"
  prev_bundle="$ARTIFACTS_DIR/claude-${prev}.js"
  out_dir="$REPO_ROOT/versions/v${curr}"
  prev_dir="$REPO_ROOT/versions/v${prev}"

  echo
  echo "═══ v$curr (← v$prev) — $(date) ═══"

  if [[ ! -f "$bundle" ]]; then
    echo "  ERROR: bundle missing $bundle"
    continue
  fi

  # 1) build index (arbor enrichment automatic when arbor is available)
  CC_GNOTHI_BUNDLE_PATH="$bundle" \
    node "$SCRIPT_DIR/extract-ast.js" --build-index \
      --bundle "$bundle" --version "$curr" 2>&1 | tail -2 | sed 's/^/  index: /'

  # 2) hashes for both versions (cached after first compute, ~1-2 min each)
  for v in "$prev" "$curr"; do
    h="$CACHE_DIR/hashes-$v.json"
    if [[ ! -f "$h" ]]; then
      vb="$ARTIFACTS_DIR/claude-$v.js"
      echo "  hash: computing for v$v..."
      node "$SCRIPT_DIR/extract-ast.js" --hash-commands \
        --bundle "$vb" --version "$v" --depth "$DEPTH" 2>&1 | tail -2 | sed 's/^/  hash: /'
    fi
  done

  # 3) cleanup: drop stale general .md (keep _index.md / _system-context.md / _handlers.json)
  removed=0
  for f in "$out_dir"/*.md; do
    [[ -f "$f" ]] || continue
    bn=$(basename "$f")
    [[ "$bn" == _* ]] && continue
    rm "$f"
    removed=$((removed + 1))
  done
  echo "  cleanup: removed $removed stale spec .md"

  # 4) classify COPY vs ANALYZE
  classification="$(python3 -c "
import json, os, sys
prev_h = json.load(open('$CACHE_DIR/hashes-$prev.json'))['commands']
new_h  = json.load(open('$CACHE_DIR/hashes-$curr.json'))['commands']
prev_dir = '$prev_dir'
for cmd, new_hash in sorted(new_h.items()):
    prev_spec = os.path.join(prev_dir, cmd + '.md')
    verified  = (os.path.exists(prev_spec) and
                 'bundle_verified: true' in open(prev_spec).read())
    if cmd in prev_h and prev_h[cmd] == new_hash and verified:
        print('COPY', cmd)
    else:
        print('ANALYZE', cmd)
")"
  n_copy=$(echo "$classification" | grep -c '^COPY ' || true)
  n_ana=$(echo "$classification" | grep -c '^ANALYZE ' || true)
  echo "  classify: $n_copy COPY + $n_ana ANALYZE"

  # 5) COPY: cp prev → curr with cc_version / updated / inherited_from
  today="$(date +%Y-%m-%d)"
  echo "$classification" | grep '^COPY ' | awk '{print $2}' | while IFS= read -r cmd; do
    [[ -z "$cmd" ]] && continue
    src="$prev_dir/${cmd}.md"
    dst="$out_dir/${cmd}.md"
    [[ -f "$src" ]] || { echo "  WARN copy: missing $src"; continue; }
    python3 -c "
import re
content = open('$src').read()
content = re.sub(r'^cc_version:.*\$', 'cc_version: \"$curr\"', content, flags=re.M)
content = re.sub(r'^updated:.*\$',    'updated: \"$today\"',  content, flags=re.M)
if 'inherited_from:' not in content:
    content = re.sub(r'^(bundle_verified: true)\$', r'\1\ninherited_from: \"$prev\"', content, count=1, flags=re.M)
open('$dst', 'w').write(content)
"
  done

  # 6) ANALYZE: 4-way split → parallel analyze-batch.js instances sharing one session
  if [[ "$n_ana" -gt 0 ]]; then
    chunk_file="$(mktemp /tmp/batch-cached-${curr}-XXXX.txt)"
    echo "$classification" | grep '^ANALYZE ' | awk '{print $2}' > "$chunk_file"

    chunk_size=$(( (n_ana + PARALLEL - 1) / PARALLEL ))
    chunk_prefix="/tmp/cc-cmd-chunk-${curr}-"
    split -l "$chunk_size" "$chunk_file" "$chunk_prefix"

    log_file="/tmp/batch-cached-${curr}.log"
    : > "$log_file"
    echo "  analyze: $PARALLEL instances spawning, log → $log_file"
    pids=()
    for chunk in ${chunk_prefix}*; do
      [[ -f "$chunk" ]] || continue
      commands="$(tr '\n' ',' < "$chunk" | sed 's/,$//')"
      [[ -z "$commands" ]] && continue
      CC_GNOTHI_SESSION_ID="cc-gnothi-batch-${curr}" \
      CC_GNOTHI_BUNDLE_PATH="$bundle" \
        node "$SCRIPT_DIR/analyze-batch.js" \
          --bundle "$bundle" \
          --version "$curr" \
          --out-dir "$out_dir" \
          --commands "$commands" \
          --depth "$DEPTH" \
          --prompt-template "$SCRIPT_DIR/prompts/analyze-command.md" \
          >> "$log_file" 2>&1 &
      pids+=($!)
    done

    fail=0
    for pid in "${pids[@]}"; do
      wait "$pid" || fail=$((fail + 1))
    done
    rm -f ${chunk_prefix}* "$chunk_file"

    if [[ "$fail" -gt 0 ]]; then
      echo "  analyze: $fail/${#pids[@]} instance(s) failed (see $log_file)"
    else
      echo "  analyze: all $PARALLEL instances OK"
    fi

    # quick cache stat summary from the per-batch log
    tail -50 "$log_file" | grep -E 'cache_(create|read)|cache hit ratio' | tail -5 | sed 's/^/  stat: /'
  fi

  # 7) inject Registration backfill rows
  node "$SCRIPT_DIR/inject-spec-fields.js" --version "$curr" 2>&1 | sed 's/^/  inject: /'

  # 8) quick sanity count — analyze-batch.js's validateSpec (PR #10) already
  # enforced frontmatter / no-Korean / required-headings per cmd. We just
  # report final spec / verified counts so a downstream eye can see whether
  # a batch fell short.
  total=$(find "$out_dir" -maxdepth 1 -name '*.md' -not -name '_*' | wc -l | tr -d ' ')
  verified=$(grep -l '^bundle_verified: true' "$out_dir"/*.md 2>/dev/null | wc -l | tr -d ' ')
  echo "  sanity: $total spec, $verified verified"

  echo "═══ v$curr done ═══"
done

t1=$(date +%s)
echo
echo "═══ Batch-cached DONE in $((t1 - t0))s ═══"
