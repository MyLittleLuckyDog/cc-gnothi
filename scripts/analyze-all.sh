#!/usr/bin/env bash
# analyze-all.sh — batch feature-spec generation via claude -p
#
# Usage:
#   ./scripts/analyze-all.sh [--version X.X.X] [--cmd NAME] [--parallel N] [--dry-run]
#
# Defaults: version=2.1.132, parallel=5, all unverified stubs
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ARTIFACTS_DIR="$(cd "$REPO_ROOT/../caludeCodeAVX2/artifacts" && pwd)"
PROMPT_TEMPLATE="$SCRIPT_DIR/prompts/analyze-command.md"

VERSION="2.1.132"
PARALLEL=5
DRY_RUN=false
SINGLE_CMD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --cmd)     SINGLE_CMD="$2"; shift 2 ;;
    --parallel) PARALLEL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

BUNDLE="$ARTIFACTS_DIR/claude-${VERSION}.js"
VERSIONS_DIR="$REPO_ROOT/versions/v${VERSION}"
TODAY="$(date +%Y-%m-%d)"

if [[ ! -f "$BUNDLE" ]]; then
  echo "ERROR: bundle not found: $BUNDLE" >&2
  exit 1
fi

# ── helpers ──────────────────────────────────────────────────────────────────

validate_output() {
  local file="$1"
  local cmd="$2"

  # Must have frontmatter
  if ! grep -q "^bundle_verified: true" "$file"; then
    echo "FAIL [$cmd]: missing bundle_verified: true" >&2
    return 1
  fi

  # No Korean characters (Hangul block U+AC00–U+D7A3 + Jamo)
  if grep -qP "[\x{AC00}-\x{D7A3}\x{1100}-\x{11FF}\x{3130}-\x{318F}]" "$file" 2>/dev/null || \
     python3 -c "
import sys, re
text = open('$file').read()
if re.search(r'[가-힣ᄀ-ᇿ㄰-㆏]', text):
    sys.exit(1)
" 2>/dev/null; then
    : # no Korean, OK (python3 check inverted: exits 0 means no match)
  else
    echo "FAIL [$cmd]: Korean text found in output" >&2
    return 1
  fi

  # Must have required sections
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

  # Skip if already verified
  if [[ -f "$out_path" ]] && grep -q "^bundle_verified: true" "$out_path"; then
    echo "SKIP [$cmd]: already verified"
    return 0
  fi

  # Build prompt by substituting template variables
  local prompt
  prompt="$(sed \
    -e "s|{COMMAND}|${cmd}|g" \
    -e "s|{VERSION}|${VERSION}|g" \
    -e "s|{BUNDLE_PATH}|${BUNDLE}|g" \
    -e "s|{TODAY}|${TODAY}|g" \
    "$PROMPT_TEMPLATE")"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "DRY-RUN [$cmd]: would run claude -p → $out_path"
    return 0
  fi

  echo "START [$cmd]"
  local tmp
  tmp="$(mktemp /tmp/cc-gnothi-${cmd}-XXXX.md)"

  if claude -p --allowed-tools "Bash Read" --add-dir "$ARTIFACTS_DIR" "$prompt" > "$tmp" 2>/tmp/cc-gnothi-${cmd}-err.log; then
    if validate_output "$tmp" "$cmd"; then
      mv "$tmp" "$out_path"
      echo "OK    [$cmd] → $out_path"
    else
      mv "$tmp" "/tmp/cc-gnothi-${cmd}-FAILED.md"
      echo "FAIL  [$cmd]: validation failed (saved to /tmp/cc-gnothi-${cmd}-FAILED.md)"
      return 1
    fi
  else
    echo "ERROR [$cmd]: claude -p failed (see /tmp/cc-gnothi-${cmd}-err.log)"
    rm -f "$tmp"
    return 1
  fi
}

export -f analyze_command validate_output
export VERSION BUNDLE VERSIONS_DIR TODAY PROMPT_TEMPLATE DRY_RUN

# ── main ─────────────────────────────────────────────────────────────────────

if [[ -n "$SINGLE_CMD" ]]; then
  analyze_command "$SINGLE_CMD"
  exit $?
fi

# Build list of unverified commands into a temp file
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
echo "Parallel: $PARALLEL | Bundle: $BUNDLE"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
  while read -r cmd; do
    analyze_command "$cmd"
  done < "$CMDS_FILE"
  rm -f "$CMDS_FILE"
  exit 0
fi

# xargs parallel execution
cat "$CMDS_FILE" | xargs -P "$PARALLEL" -I{} bash -c 'analyze_command "$@"' _ {}
rm -f "$CMDS_FILE"

echo ""
echo "── Done ──"
