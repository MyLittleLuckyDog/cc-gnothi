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
ARTIFACTS_DIR="$(cd "$REPO_ROOT/../caludeCodeAVX2/artifacts" && pwd)"
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
    analyze_command "$cmd" || true
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

  # Build optional prompt-body block — injected only when a _raw/${cmd}.txt
  # dump exists for this command (currently prompt-type registrations:
  # init, init-verifiers, review, insights, team-onboarding, statusline...).
  # Carries the actual text the command sends to the agent at invocation, so
  # the Behavioral Spec can be grounded in what is really instructed.
  #
  # Built with printf (not heredoc) to avoid backtick-triggered command
  # substitution inside markdown code spans.
  local prompt_body_block=""
  if [[ -f "$VERSIONS_DIR/_raw/${cmd}.txt" ]]; then
    local _raw_content
    _raw_content="$(cat "$VERSIONS_DIR/_raw/${cmd}.txt")"
    prompt_body_block="$(printf '%s\n' \
      '' \
      '---' \
      '' \
      '## Pre-Extracted Prompt Body' \
      '' \
      "The block below is the actual prompt that the /${cmd} command sends to" \
      "the agent at invocation, extracted from the v${VERSION} bundle's" \
      'getPromptForCommand method (with 1-hop into referenced functions and' \
      'top-level variables). Use it to ground the Behavioral Spec in what the' \
      'command actually tells the agent. Do NOT quote it verbatim beyond short' \
      'fragments needed for citation (bundle is (c) Anthropic PBC).' \
      '' \
      "$_raw_content")"
  fi

  # Build prompt: template variables + embed JSON data + optional prompt body
  local prompt
  prompt="$(sed \
    -e "s|{COMMAND}|${cmd}|g" \
    -e "s|{VERSION}|${VERSION}|g" \
    -e "s|{TODAY}|${TODAY}|g" \
    "$PROMPT_TEMPLATE" \
  | sed "s|{AST_JSON}|PLACEHOLDER_AST_JSON|" \
  | sed "s|{PROMPT_BODY}|PLACEHOLDER_PROMPT_BODY|")"
  prompt="${prompt/PLACEHOLDER_AST_JSON/$json_data}"
  prompt="${prompt/PLACEHOLDER_PROMPT_BODY/$prompt_body_block}"

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
# Note: CLAUDE_GATEWAY_URL / ANTHROPIC_API_KEY inherited from environment if set

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

if [[ -n "$SINGLE_CMD" ]]; then
  analyze_command "$SINGLE_CMD"
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

  if [[ "$PARALLEL" -gt 1 ]]; then
    # COPY: sequential (즉시 — 파일 cp 만)
    echo "$CLASSIFICATION" | grep "^COPY " | while IFS=' ' read -r _ cmd; do
      copy_from_version "$cmd" "$FROM_VERSION"
    done
    # ANALYZE: parallel via xargs. Each spawned bash re-enters this script
    # in `--cmd` mode, so analyze_command's own SKIP-if-verified gate
    # avoids redoing already-finished commands when the run is resumed.
    echo "$CLASSIFICATION" | grep "^ANALYZE " | awk '{print $2}' | \
      xargs -I{} -P "$PARALLEL" bash "$0" --version "$VERSION" --cmd "{}" --depth "$DEPTH"
  else
    while IFS=' ' read -r action cmd; do
      if [[ "$action" == "COPY" ]]; then
        copy_from_version "$cmd" "$FROM_VERSION"
      else
        analyze_command "$cmd" || true
      fi
    done <<< "$CLASSIFICATION"
  fi

  echo ""
  echo "── Done: v${VERSION} ──"
  exit 0
fi

# ── Standard batch mode (no --from-version) ──────────────────────────────────

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
