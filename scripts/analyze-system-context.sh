#!/usr/bin/env bash
# analyze-system-context.sh — extract and document CC system context layer
#
# Usage:
#   ./scripts/analyze-system-context.sh [--version X.X.X] [--dry-run] [--min-len N] [--force]
#
# Produces: versions/v{X.X.X}/_system-context.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ARTIFACTS_DIR="$(cd "$REPO_ROOT/../caludeCodeAVX2/artifacts" && pwd)"
PROMPT_TEMPLATE="$SCRIPT_DIR/prompts/analyze-system-context.md"

VERSION="2.1.143"
DRY_RUN=false
MIN_LEN=500
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)  VERSION="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=true; shift ;;
    --min-len)  MIN_LEN="$2"; shift 2 ;;
    --force)    FORCE=true;   shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

BUNDLE="$ARTIFACTS_DIR/claude-${VERSION}.js"
VERSIONS_DIR="$REPO_ROOT/versions/v${VERSION}"
INDEX_PATH="$HOME/.cc-gnothi/cache/index-${VERSION}.json"
SC_CACHE="$HOME/.cc-gnothi/cache/system-context-${VERSION}.json"
OUT_PATH="$VERSIONS_DIR/_system-context.md"
TODAY="$(date +%Y-%m-%d)"

if [[ ! -f "$BUNDLE" ]]; then
  echo "ERROR: bundle not found: $BUNDLE" >&2
  exit 1
fi

mkdir -p "$VERSIONS_DIR"

# ── Validate output helper ────────────────────────────────────────────────────

validate_output() {
  local file="$1"

  if ! grep -q "^bundle_verified: true" "$file"; then
    echo "FAIL: missing bundle_verified: true" >&2
    return 1
  fi

  if python3 -c "
import sys, re
text = open('$file').read()
if re.search(r'[가-힣ᄀ-ᇿ㄰-㆏]', text):
    sys.exit(1)
" 2>/dev/null; then
    : # no Korean, OK
  else
    echo "FAIL: Korean text found in output" >&2
    return 1
  fi

  for section in "## Overview" "## Hardcoded Constraints" "## CLAUDE.md Redundancy Warning" "## User Actionable Insights"; do
    if ! grep -q "^$section" "$file"; then
      echo "FAIL: missing section '$section'" >&2
      return 1
    fi
  done

  return 0
}

# ── Skip if already verified ──────────────────────────────────────────────────

if [[ "$FORCE" == "false" ]] && [[ -f "$OUT_PATH" ]] && grep -q "^bundle_verified: true" "$OUT_PATH"; then
  echo "SKIP: $OUT_PATH already verified (use --force to re-analyze)"
  exit 0
fi

# ── Build AST index if needed ─────────────────────────────────────────────────

if [[ ! -f "$INDEX_PATH" ]]; then
  echo "Building AST index for v${VERSION} (one-time, ~5s)..."
  node "$SCRIPT_DIR/extract-ast.js" --build-index --bundle "$BUNDLE" --version "$VERSION"
fi

# ── Extract system context (or use cache) ─────────────────────────────────────

if [[ ! -f "$SC_CACHE" ]] || [[ "$FORCE" == "true" ]]; then
  echo "Extracting system context for v${VERSION} (scanning ~17k functions)..."
  node "$SCRIPT_DIR/extract-ast.js" \
    --dump-system-context \
    --bundle "$BUNDLE" \
    --version "$VERSION" \
    --index "$INDEX_PATH" \
    --min-len "$MIN_LEN" \
    2>&1 | grep -v "^$"
fi

json_data="$(cat "$SC_CACHE")"
fn_count="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(len(d['systemContextFunctions']))" "$json_data")"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "DRY-RUN: extracted ${fn_count} candidates ($(echo "$json_data" | wc -c) bytes) → would call API → $OUT_PATH"
  exit 0
fi

echo "Building prompt (${fn_count} candidate functions)..."

# ── Build prompt using Python (handles any special chars safely) ───────────────

prompt_file="$(mktemp /tmp/cc-gnothi-system-context-prompt-XXXX.txt)"
python3 - "$PROMPT_TEMPLATE" "$SC_CACHE" "$VERSION" "$TODAY" <<'PYEOF' > "$prompt_file"
import sys
tmpl_path, data_path, ver, today = sys.argv[1:5]
tmpl = open(tmpl_path).read()
data = open(data_path).read()
out  = tmpl.replace('{VERSION}', ver).replace('{TODAY}', today).replace('{AST_JSON}', data)
print(out, end='')
PYEOF

echo "Calling API for _system-context v${VERSION}..."
tmp="$(mktemp /tmp/cc-gnothi-system-context-XXXX.md)"

if node "$SCRIPT_DIR/call-api.js" --prompt-file "$prompt_file" > "$tmp" \
     2>/tmp/cc-gnothi-system-context-err.log; then
  rm -f "$prompt_file"
  if validate_output "$tmp"; then
    mv "$tmp" "$OUT_PATH"
    echo "OK → $OUT_PATH"
  else
    mv "$tmp" "/tmp/cc-gnothi-system-context-FAILED.md"
    echo "FAIL: validation failed (saved to /tmp/cc-gnothi-system-context-FAILED.md)"
    exit 1
  fi
else
  rm -f "$prompt_file"
  echo "ERROR: API call failed (see /tmp/cc-gnothi-system-context-err.log)"
  rm -f "$tmp"
  exit 1
fi
