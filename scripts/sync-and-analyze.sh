#!/usr/bin/env bash
# sync-and-analyze.sh
#
# 1. Pull latest caludeCodeAVX2 (read-only, downstream-only)
# 2. Run analyze-new-version.js for any undocumented artifact versions
#
# Usage:
#   ./scripts/sync-and-analyze.sh [--dry-run]
#
# Prerequisites:
#   - git remote "origin" set in caludeCodeAVX2
#   - node >= 18 in PATH

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AVAX2_DIR="$(cd "$REPO_ROOT/../claudeCodeAVX2" && pwd)"
ARTIFACTS_DIR="$AVAX2_DIR/artifacts"
DRY_RUN="${1:-}"

echo "=== sync-and-analyze ==="
echo "  cc-gnothi:       $REPO_ROOT"
echo "  caludeCodeAVX2:  $AVAX2_DIR"
echo "  dry-run:         ${DRY_RUN}"

# ── Step 1: Pull caludeCodeAVX2 ───────────────────────────────────────────────

echo ""
echo "── Step 1: Syncing caludeCodeAVX2 ──"
cd "$AVAX2_DIR"

BEFORE=$(ls "$ARTIFACTS_DIR"/claude-*.js 2>/dev/null | sort | tail -1 || echo "none")

git fetch --quiet origin
git merge --ff-only origin/main

AFTER=$(ls "$ARTIFACTS_DIR"/claude-*.js 2>/dev/null | sort | tail -1 || echo "none")

if [ "$BEFORE" = "$AFTER" ]; then
  echo "  No new artifacts (latest: $(basename "$AFTER" 2>/dev/null || echo 'none'))"
else
  echo "  New artifact detected: $(basename "$AFTER")"
fi

# ── Step 2: Analyze undocumented versions ────────────────────────────────────

echo ""
echo "── Step 2: Running analyze-new-version.js ──"
cd "$REPO_ROOT"

ANALYZE_ARGS=(
  "--artifacts" "$ARTIFACTS_DIR"
  "--versions"  "$REPO_ROOT/versions"
)

if [ "$DRY_RUN" = "--dry-run" ]; then
  ANALYZE_ARGS+=("--dry-run")
fi

node "$SCRIPT_DIR/analyze-new-version.js" "${ANALYZE_ARGS[@]}"

echo ""
echo "=== Done ==="
