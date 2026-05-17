#!/usr/bin/env bash
# analyze-all.sh — batch feature-spec generation via claude -p
#
# Usage:
#   ./scripts/analyze-all.sh [--version X.X.X] [--cmd NAME] [--dry-run] [--depth N]
#
# Defaults: version=2.1.132, depth=2, sequential, all unverified stubs
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ARTIFACTS_DIR="$(cd "$REPO_ROOT/../caludeCodeAVX2/artifacts" && pwd)"
PROMPT_TEMPLATE="$SCRIPT_DIR/prompts/analyze-command.md"

VERSION="2.1.132"
DRY_RUN=false
SINGLE_CMD=""
DEPTH=2

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)  VERSION="$2"; shift 2 ;;
    --cmd)      SINGLE_CMD="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=true; shift ;;
    --depth)    DEPTH="$2"; shift 2 ;;
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

# ── helpers ───────────────────────────────────────────────────────────────────

validate_output() {
  local file="$1"
  local cmd="$2"

  if ! grep -q "^bundle_verified: true" "$file"; then
    echo "FAIL [$cmd]: missing bundle_verified: true" >&2
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
    echo "FAIL [$cmd]: Korean text found in output" >&2
    return 1
  fi

  for section in "## Overview" "## Registration" "## Behavioral Spec"; do
    if ! grep -q "^$section" "$file"; then
      echo "FAIL [$cmd]: missing section '$section'" >&2
      return 1
    fi
  done

  return 0
}

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

  # Build prompt: template variables + embed JSON data
  local prompt
  prompt="$(sed \
    -e "s|{COMMAND}|${cmd}|g" \
    -e "s|{VERSION}|${VERSION}|g" \
    -e "s|{TODAY}|${TODAY}|g" \
    "$PROMPT_TEMPLATE" \
  | sed "s|{AST_JSON}|PLACEHOLDER_AST_JSON|")"
  prompt="${prompt/PLACEHOLDER_AST_JSON/$json_data}"

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

export -f analyze_command validate_output
export VERSION BUNDLE VERSIONS_DIR TODAY PROMPT_TEMPLATE DRY_RUN DEPTH SCRIPT_DIR INDEX_PATH
# Note: CLAUDE_GATEWAY_URL / ANTHROPIC_API_KEY inherited from environment if set

# ── main ──────────────────────────────────────────────────────────────────────

if [[ -n "$SINGLE_CMD" ]]; then
  analyze_command "$SINGLE_CMD"
  exit $?
fi

CMDS_FILE="$(mktemp /tmp/cc-gnothi-cmds-XXXX.txt)"
ls "$VERSIONS_DIR"/*.md 2>/dev/null \
  | grep -v "_index.md" \
  | while read -r f; do
      cmd="$(basename "$f" .md)"
      out="$VERSIONS_DIR/${cmd}.md"
      if [[ ! -f "$out" ]] || ! grep -q "^bundle_verified: true" "$out"; then
        echo "$cmd"
      fi
    done > "$CMDS_FILE"

CMD_COUNT="$(wc -l < "$CMDS_FILE" | tr -d ' ')"

if [[ "$CMD_COUNT" -eq 0 ]]; then
  echo "All commands already verified."
  rm -f "$CMDS_FILE"
  exit 0
fi

echo "Commands to analyze ($CMD_COUNT):"
cat "$CMDS_FILE"
echo ""
echo "Sequential | Bundle: $BUNDLE | Depth: $DEPTH"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
  while read -r cmd; do
    analyze_command "$cmd"
  done < "$CMDS_FILE"
  rm -f "$CMDS_FILE"
  exit 0
fi

# Sequential — rate limit friendly
while read -r cmd; do
  analyze_command "$cmd" || true
done < "$CMDS_FILE"
rm -f "$CMDS_FILE"

echo ""
echo "── Done ──"
