#!/usr/bin/env bash
# analyze-all.sh — batch feature-spec generation
#
# Usage:
#   ./scripts/analyze-all.sh [--version X.X.X] [--from-version X.X.X] [--cmd NAME] [--dry-run] [--depth N]
#
# --from-version: diff-based analysis — copies unchanged specs, analyzes changed/new ones
# Defaults: version=2.1.132, depth=2, sequential
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Bundle artifacts directory. Defaults to a sibling `caludeCodeAVX2`
# repo (the most common host layout); override with `CC_GNOTHI_ARTIFACTS`
# when the source repo lives elsewhere.
ARTIFACTS_DIR="${CC_GNOTHI_ARTIFACTS:-$(cd "$REPO_ROOT/../claudeCodeAVX2/artifacts" 2>/dev/null && pwd)}"
if [[ -z "$ARTIFACTS_DIR" || ! -d "$ARTIFACTS_DIR" ]]; then
  echo "ERROR: artifacts dir not found (set CC_GNOTHI_ARTIFACTS or clone caludeCodeAVX2 next to cc-gnothi)" >&2
  exit 1
fi
PROMPT_TEMPLATE="$SCRIPT_DIR/prompts/analyze-command.md"

VERSION="2.1.132"
FROM_VERSION=""
DRY_RUN=false
SINGLE_CMD=""
DEPTH=2
PARALLEL=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)      VERSION="$2";      shift 2 ;;
    --from-version) FROM_VERSION="$2"; shift 2 ;;
    --cmd)          SINGLE_CMD="$2";   shift 2 ;;
    --dry-run)      DRY_RUN=true;      shift ;;
    --depth)        DEPTH="$2";        shift 2 ;;
    --parallel)     PARALLEL="$2";     shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

BUNDLE="$ARTIFACTS_DIR/claude-${VERSION}.js"
VERSIONS_DIR="$REPO_ROOT/versions/v${VERSION}"
INDEX_PATH="$HOME/.cc-gnothi/cache/index-${VERSION}.json"
TODAY="$(date +%Y-%m-%d)"

if [[ ! -f "$BUNDLE" ]]; then
  echo "ERROR: bundle not found: $BUNDLE" >&2
  exit 1
fi

# ── Build AST index if needed ─────────────────────────────────────────────────

if [[ ! -f "$INDEX_PATH" ]]; then
  echo "Building AST index for v${VERSION} (one-time, ~5s)..."
  node "$SCRIPT_DIR/extract-ast.js" --build-index --bundle "$BUNDLE" --version "$VERSION"
fi

mkdir -p "$VERSIONS_DIR"

# ── helpers ───────────────────────────────────────────────────────────────────
#
# After PRs #10 / #11 / #12 the three analyze modes (standard batch,
# `--cmd`, `--from-version`) all delegate to `scripts/analyze-batch.js`,
# which carries validate / SKIP / placeholder substitution / prompt_body
# directly. The old bash helpers `analyze_command` and `validate_output`
# are removed here. `copy_from_version` stays — `--from-version` still
# uses it for the COPY classification, and its fallback (missing source
# spec) now delegates to analyze-batch.js as a single-command driver
# call.

copy_from_version() {
  local cmd="$1"
  local from_ver="$2"
  local src="$REPO_ROOT/versions/v${from_ver}/${cmd}.md"
  local dst="$VERSIONS_DIR/${cmd}.md"

  if [[ -f "$dst" ]] && grep -q "^bundle_verified: true" "$dst"; then
    echo "SKIP  [$cmd]: already verified in v${VERSION}"
    return 0
  fi

  if [[ ! -f "$src" ]]; then
    echo "WARN  [$cmd]: no verified spec in v${from_ver} — will analyze"
    node "$SCRIPT_DIR/analyze-batch.js" \
      --bundle "$BUNDLE" \
      --version "$VERSION" \
      --out-dir "$VERSIONS_DIR" \
      --depth "$DEPTH" \
      --commands "$cmd" || true
    return 0
  fi

  python3 -c '
import re, sys
src, dst, ver, today, from_ver = sys.argv[1:6]
content = open(src).read()
content = re.sub(r"^(cc_version:).*$", r"\g<1> " + ver, content, flags=re.M)
content = re.sub(r"^(date:).*$", r"\g<1> " + today, content, flags=re.M)
if "inherited_from:" not in content:
    content = re.sub(r"^(bundle_verified: true)", r"\1" + "\ninherited_from: " + from_ver,
                     content, count=1, flags=re.M)
open(dst, "w").write(content)
' "$src" "$dst" "$VERSION" "$TODAY" "$from_ver"

  echo "COPY  [$cmd]: v${from_ver} → v${VERSION}"
}

# All analyze paths now delegate to scripts/analyze-batch.js (one
# long-lived client + pinned X-Session-Id), so the cross-process
# function exports the old xargs-P self-invoke needed are gone.
# Keep the env exports for any extra-shell tooling that still
# expects them.

analyze_command() {
  local cmd="$1"
  local out_path="$VERSIONS_DIR/${cmd}.md"

  if [[ -f "$out_path" ]] && grep -q "^bundle_verified: true" "$out_path"; then
    echo "SKIP [$cmd]: already verified"
    return 0
  fi

  echo "START [$cmd]"

  # Extract AST data for this command
  local json_data
  if ! json_data="$(node "$SCRIPT_DIR/extract-ast.js" \
    --cmd "$cmd" \
    --bundle "$BUNDLE" \
    --index "$INDEX_PATH" \
    --depth "$DEPTH" \
    2>/tmp/cc-gnothi-${cmd}-ast-err.log)"; then
    echo "ERROR [$cmd]: AST extraction failed (see /tmp/cc-gnothi-${cmd}-ast-err.log)"
    return 1
  fi

  if [[ -z "$json_data" ]]; then
    echo "ERROR [$cmd]: AST extraction produced no output"
    return 1
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "DRY-RUN [$cmd]: AST OK ($(echo "$json_data" | wc -c) bytes) → would call API → $out_path"
    return 0
  fi

  # ── Arbor context enrichment (optional, graceful fallback) ─────────────────
  # If `arbor` is on PATH and a graph snapshot exists for this version, call
  # `arbor context --fqn` to get a pre-resolved handler + immediate callees.
  # The result is injected into the prompt as ## Arbor Graph Context so the
  # LLM starts the spec with the handler FQN already confirmed.
  local arbor_context=""
  local handler_name
  handler_name="$(echo "$json_data" | python3 -c \
    "import json,sys; d=json.load(sys.stdin); print(d.get('handler_name',''))" 2>/dev/null || true)"
  local arbor_graph="${HOME}/.cc-gnothi/cache/arbor-graph-${VERSION}.json"
  if [[ -n "$handler_name" ]] && command -v arbor &>/dev/null && [[ -f "$arbor_graph" ]]; then
    local arbor_out
    arbor_out="$(arbor context \
      --fqn "claude-${VERSION}::${handler_name}" \
      --path "$(dirname "$BUNDLE")" \
      --graph "$arbor_graph" \
      --depth 2 \
      --output md \
      2>/dev/null || true)"
    if [[ -n "$arbor_out" ]]; then
      arbor_context="$(printf '\n## Arbor Graph Context (pre-resolved handler + call structure)\n\n> Source: arbor context --fqn claude-%s::%s --depth 2\n> Use the FQN and callee list below as the confirmed starting point — they are\n> graph-verified, not inferred. Cite locations as bundle.js:+{loc_byte}.\n\n%s' \
        "$VERSION" "$handler_name" "$arbor_out")"
      echo "  arbor context: ${handler_name} → $(echo "$arbor_out" | wc -l | tr -d ' ') lines"
    fi
  fi

  # Build prompt: template variables + embed JSON data + Arbor context
  local prompt
  prompt="$(sed \
    -e "s|{COMMAND}|${cmd}|g" \
    -e "s|{VERSION}|${VERSION}|g" \
    -e "s|{TODAY}|${TODAY}|g" \
    "$PROMPT_TEMPLATE" \
  | sed "s|{AST_JSON}|PLACEHOLDER_AST_JSON|" \
  | sed "s|{ARBOR_CONTEXT}|PLACEHOLDER_ARBOR_CONTEXT|")"
  prompt="${prompt/PLACEHOLDER_AST_JSON/$json_data}"
  prompt="${prompt/PLACEHOLDER_ARBOR_CONTEXT/$arbor_context}"

  # Write prompt to temp file (avoids shell arg length limits)
  local prompt_file tmp
  prompt_file="$(mktemp /tmp/cc-gnothi-${cmd}-prompt-XXXX.txt)"
  echo "$prompt" > "$prompt_file"
  tmp="$(mktemp /tmp/cc-gnothi-${cmd}-XXXX.md)"

  if node "$SCRIPT_DIR/call-api.js" --prompt-file "$prompt_file" > "$tmp" \
       2>/tmp/cc-gnothi-${cmd}-err.log; then
    rm -f "$prompt_file"
    if validate_output "$tmp" "$cmd"; then
      mv "$tmp" "$out_path"
      echo "OK    [$cmd] → $out_path"
    else
      mv "$tmp" "/tmp/cc-gnothi-${cmd}-FAILED.md"
      echo "FAIL  [$cmd]: validation failed (saved to /tmp/cc-gnothi-${cmd}-FAILED.md)"
      return 1
    fi
  else
    rm -f "$prompt_file"
    echo "ERROR [$cmd]: API call failed (see /tmp/cc-gnothi-${cmd}-err.log)"
    rm -f "$tmp"
    return 1
  fi
}

export -f analyze_command validate_output copy_from_version
export VERSION BUNDLE VERSIONS_DIR TODAY PROMPT_TEMPLATE DRY_RUN DEPTH SCRIPT_DIR INDEX_PATH REPO_ROOT
# Note: CLAUDE_GATEWAY_URL / ANTHROPIC_API_KEY / CC_GNOTHI_SESSION_ID
# inherited from environment if set.

# Backfill PR #3/#4 + Arbor rows on the way out. The prompt template marks
# them REQUIRED, but the script also runs deterministically at exit time so
# any LLM that still omitted them gets fixed without a second API call.
# inject-spec-fields.js is idempotent and processes every command in the
# version dir; skipped in dry-run because no specs were actually written.
inject_missing_fields() {
  if [[ "$DRY_RUN" == "true" ]]; then return 0; fi
  node "$SCRIPT_DIR/inject-spec-fields.js" --version "$VERSION" 2>&1 \
    | sed 's/^/  inject-fields: /'
}
trap inject_missing_fields EXIT

# ── Single command mode ───────────────────────────────────────────────────────

# PR #10 migrated the standard-batch loop to analyze-batch.js;
# this path is the trivial 1-command equivalent. SKIP /
# validation / placeholder substitution / prompt_body block all
# happen inside the driver, matching analyze_command's behavior
# 1:1. Kept here as a small wrapper so callers can keep using
# `analyze-all.sh --cmd foo`.
if [[ -n "$SINGLE_CMD" ]]; then
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "DRY-RUN [$SINGLE_CMD]: would invoke analyze-batch.js with --commands '$SINGLE_CMD'"
    exit 0
  fi
  node "$SCRIPT_DIR/analyze-batch.js" \
    --bundle "$BUNDLE" \
    --version "$VERSION" \
    --out-dir "$VERSIONS_DIR" \
    --depth "$DEPTH" \
    --commands "$SINGLE_CMD"
  exit $?
fi

# ── Diff-based mode (--from-version) ─────────────────────────────────────────

if [[ -n "$FROM_VERSION" ]]; then
  PREV_BUNDLE="$ARTIFACTS_DIR/claude-${FROM_VERSION}.js"
  PREV_INDEX="$HOME/.cc-gnothi/cache/index-${FROM_VERSION}.json"
  PREV_HASHES="$HOME/.cc-gnothi/cache/hashes-${FROM_VERSION}.json"
  NEW_HASHES="$HOME/.cc-gnothi/cache/hashes-${VERSION}.json"
  PREV_VERSIONS_DIR="$REPO_ROOT/versions/v${FROM_VERSION}"

  if [[ ! -f "$PREV_BUNDLE" ]]; then
    echo "ERROR: prev bundle not found: $PREV_BUNDLE" >&2
    exit 1
  fi

  # Build prev index if needed
  if [[ ! -f "$PREV_INDEX" ]]; then
    echo "Building AST index for v${FROM_VERSION}..."
    node "$SCRIPT_DIR/extract-ast.js" --build-index --bundle "$PREV_BUNDLE" --version "$FROM_VERSION"
  fi

  # Build hashes for both versions (structural fingerprint, one-time per version)
  if [[ ! -f "$PREV_HASHES" ]]; then
    echo "Computing structural hashes for v${FROM_VERSION} (~1-2 min)..."
    node "$SCRIPT_DIR/extract-ast.js" --hash-commands \
      --bundle "$PREV_BUNDLE" --version "$FROM_VERSION" --depth "$DEPTH" 2>&1 | grep -v "^$"
  fi

  if [[ ! -f "$NEW_HASHES" ]]; then
    echo "Computing structural hashes for v${VERSION} (~1-2 min)..."
    node "$SCRIPT_DIR/extract-ast.js" --hash-commands \
      --bundle "$BUNDLE" --version "$VERSION" --depth "$DEPTH" 2>&1 | grep -v "^$"
  fi

  # Classify commands: COPY (same fingerprint + prev verified) vs ANALYZE (changed/new)
  CLASSIFICATION="$(python3 -c '
import json, os, sys
prev_h   = json.load(open(sys.argv[1]))["commands"]
new_h    = json.load(open(sys.argv[2]))["commands"]
prev_dir = sys.argv[3]
for cmd, new_hash in sorted(new_h.items()):
    prev_spec = os.path.join(prev_dir, cmd + ".md")
    verified  = (os.path.exists(prev_spec) and
                 "bundle_verified: true" in open(prev_spec).read())
    if cmd in prev_h and prev_h[cmd] == new_hash and verified:
        print("COPY", cmd)
    else:
        print("ANALYZE", cmd)
' "$PREV_HASHES" "$NEW_HASHES" "$PREV_VERSIONS_DIR")"

  COPY_COUNT=$(echo "$CLASSIFICATION" | grep -c "^COPY " || true)
  ANALYZE_COUNT=$(echo "$CLASSIFICATION" | grep -c "^ANALYZE " || true)

  echo ""
  echo "v${FROM_VERSION} → v${VERSION}: ${COPY_COUNT} unchanged (copy), ${ANALYZE_COUNT} changed/new (analyze)"
  echo ""

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "$CLASSIFICATION"
    echo ""
    echo "── Dry run complete ──"
    exit 0
  fi

  # COPY 는 즉시 파일 cp — 여기서 sequential 처리.
  echo "$CLASSIFICATION" | grep "^COPY " | while IFS=' ' read -r _ cmd; do
    copy_from_version "$cmd" "$FROM_VERSION"
  done

  # ANALYZE 는 analyze-batch.js 한 번 호출. 같은 long-lived
  # client + pinned X-Session-Id 라서 gateway 측 cache 가 연속
  # 호출 사이에 살아있고, --from-version 의 changed-cmds 는 보통
  # 작은 set (몇~수십 개) 이라 sequential 도 빠름. PARALLEL > 1
  # 옵션이 들어왔으면 batch-cached.sh 패턴 (chunked parallel) 을
  # 별도 wrapper 로 돌리는 게 더 정확 — 여기서는 warn 후 무시.
  ANALYZE_CMDS="$(echo "$CLASSIFICATION" | grep "^ANALYZE " | awk '{print $2}' | tr '\n' ',' | sed 's/,$//')"

  if [[ -z "$ANALYZE_CMDS" ]]; then
    echo "Nothing to ANALYZE (all $COPY_COUNT commands unchanged + verified)."
    echo ""
    echo "── Done: v${VERSION} ──"
    exit 0
  fi

  if [[ "$PARALLEL" -gt 1 ]]; then
    echo "Note: --parallel $PARALLEL is no longer split per-command at the bash level;" >&2
    echo "      analyze-batch.js batches all ANALYZE cmds in one long-lived client" >&2
    echo "      (cache-friendly). Use scripts/batch-cached.sh for chunked parallel." >&2
  fi

  node "$SCRIPT_DIR/analyze-batch.js" \
    --bundle "$BUNDLE" \
    --version "$VERSION" \
    --out-dir "$VERSIONS_DIR" \
    --depth "$DEPTH" \
    --commands "$ANALYZE_CMDS"

  echo ""
  echo "── Done: v${VERSION} ──"
  exit 0
fi

# ── Standard batch mode (no --from-version) ──────────────────────────────────

# Build the list of commands that still need ANALYZE: every .md in
# the version dir that lacks `bundle_verified: true`. The directory
# may not exist yet (first-time analysis run) — be quiet in that
# case and let analyze-batch.js fall back to the build-index cache
# (it reads from `~/.cc-gnothi/cache/index-${VERSION}.json`).
CMDS_FILE="$(mktemp /tmp/cc-gnothi-cmds-XXXX.txt)"
if [[ -d "$VERSIONS_DIR" ]]; then
  ls "$VERSIONS_DIR"/*.md 2>/dev/null \
    | grep -v "_index.md" \
    | while read -r f; do
        cmd="$(basename "$f" .md)"
        out="$VERSIONS_DIR/${cmd}.md"
        if [[ ! -f "$out" ]] || ! grep -q "^bundle_verified: true" "$out"; then
          echo "$cmd"
        fi
      done > "$CMDS_FILE"
fi
CMD_COUNT="$(wc -l < "$CMDS_FILE" | tr -d ' ')"

# Empty CMDS_FILE → let the batch driver use the bundle's full
# command list from the build-index cache. Skips happen inside the
# driver via `bundle_verified: true` detection, same gate as the
# old loop.
if [[ "$CMD_COUNT" -eq 0 ]]; then
  echo "Standard batch mode | Bundle: $BUNDLE | (no per-spec filter; driver SKIPs verified)"
else
  echo "Commands to analyze ($CMD_COUNT):"
  cat "$CMDS_FILE"
  echo ""
  echo "Standard batch mode | Bundle: $BUNDLE | Depth: $DEPTH"
fi
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
  if [[ "$CMD_COUNT" -gt 0 ]]; then
    while read -r cmd; do
      echo "DRY-RUN [$cmd]: would invoke analyze-batch.js"
    done < "$CMDS_FILE"
  else
    echo "DRY-RUN: would invoke analyze-batch.js with full bundle command list"
  fi
  rm -f "$CMDS_FILE"
  exit 0
fi

# Migrated path — invoke the single-process batch driver once with
# all pending commands. One long-lived Anthropic client = stable
# X-Session-Id at the gateway = prompt-cache continuity across the
# batch (validated 80% hit ratio in PR #9). Validation and SKIP
# logic live inside analyze-batch.js (validateSpec /
# isAlreadyVerified), matching analyze-all.sh's analyze_command
# behavior 1:1.
BATCH_ARGS=(
  --bundle "$BUNDLE"
  --version "$VERSION"
  --out-dir "$VERSIONS_DIR"
  --depth "$DEPTH"
)
if [[ "$CMD_COUNT" -gt 0 ]]; then
  CMDS_JOINED="$(tr '\n' ',' < "$CMDS_FILE" | sed 's/,$//')"
  BATCH_ARGS+=(--commands "$CMDS_JOINED")
fi
rm -f "$CMDS_FILE"

node "$SCRIPT_DIR/analyze-batch.js" "${BATCH_ARGS[@]}"
exit_code=$?

echo ""
echo "── Done ──"
exit $exit_code
