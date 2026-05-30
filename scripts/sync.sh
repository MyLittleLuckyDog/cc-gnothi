#!/usr/bin/env bash
# sync.sh — auto-detect new CC bundles, analyze, commit, push
#
# Runs as a system cron job. Fully unattended:
#   - pulls caludeCodeAVX2 for new bundles
#   - starts claude-gateway if not running
#   - runs diff-based analysis for each new version
#   - commits + pushes results to cc-gnothi
#
# Idempotent: versions with committed specs are skipped.
set -euo pipefail

export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:/usr/sbin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 로컬 시크릿 로드 (커밋되지 않음)
[[ -f "$SCRIPT_DIR/../.env.local" ]] && source "$SCRIPT_DIR/../.env.local"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AVX2_REPO="/Volumes/juryu_home/with_AI/projects/0x.tools/caludeCodeAVX2"
ARTIFACTS_DIR="$AVX2_REPO/artifacts"
GATEWAY_BIN="/Volumes/juryu_home/with_AI/projects/06.DenoV8POC/01.Tools/claude-gateway/target/release/claude-agent-rs"
LOG_FILE="/tmp/cc-gnothi-sync.log"
TG_TOKEN="${CC_GNOTHI_TG_TOKEN:-}"
TG_CHAT_ID="${CC_GNOTHI_TG_CHAT_ID:-}"

tg_notify() {
  [[ -z "${TG_TOKEN}" ]] && return 0
  curl -s "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    -d chat_id="${TG_CHAT_ID}" \
    -d text="$1" > /dev/null 2>&1 || true
}
LOCKFILE="/tmp/cc-gnothi-sync.lock"
LOG_PREFIX="[cc-gnothi $(date '+%Y-%m-%d %H:%M')]"

exec >> "$LOG_FILE" 2>&1

echo ""
echo "──────────────────────────────────────────"
echo "$LOG_PREFIX START"

# ── Lockfile (prevent overlap with long-running analysis) ────────────────────

if ! ( set -C; echo $$ > "$LOCKFILE" ) 2>/dev/null; then
  echo "$LOG_PREFIX Already running (PID $(cat "$LOCKFILE")), skipping"
  exit 0
fi
trap "rm -f $LOCKFILE" EXIT

# ── Volume check ──────────────────────────────────────────────────────────────

if [[ ! -d "$AVX2_REPO" ]]; then
  echo "$LOG_PREFIX SKIP: caludeCodeAVX2 not mounted"
  exit 0
fi

# ── Pull latest bundles ───────────────────────────────────────────────────────

echo "$LOG_PREFIX Pulling caludeCodeAVX2..."
# capture then print: avoids SIGPIPE aborting the script under `set -o pipefail`
# when fast-forward output exceeds `head -N` lines
pull_out=$(git -C "$AVX2_REPO" pull --ff-only origin main 2>&1)
echo "$pull_out" | head -3

echo "$LOG_PREFIX Pulling cc-gnothi..."
pull_out=$(git -C "$REPO_ROOT" pull --ff-only origin main 2>&1)
echo "$pull_out" | head -3

# ── Detect analyzed vs new versions ──────────────────────────────────────────

ALL_SORTED=()
while IFS= read -r line; do
  [[ -n "$line" ]] && ALL_SORTED+=("$line")
done < <(ls "$ARTIFACTS_DIR"/claude-*.js 2>/dev/null \
  | sed 's|.*/claude-||; s|\.js$||' \
  | sort -V)

if [[ ${#ALL_SORTED[@]} -eq 0 ]]; then
  echo "$LOG_PREFIX No bundles found in $ARTIFACTS_DIR"
  exit 0
fi

# A version is "analyzed" when it has at least one committed spec with bundle_verified: true
ANALYZED_VERSIONS=$(git -C "$REPO_ROOT" grep -l "^bundle_verified: true" -- "versions/v*/*.md" 2>/dev/null \
  | sed 's|versions/v||; s|/.*||' \
  | sort -u)

is_analyzed() { echo "$ANALYZED_VERSIONS" | grep -qx "$1"; }

NEW_VERSIONS=()
for ver in "${ALL_SORTED[@]}"; do
  is_analyzed "$ver" || NEW_VERSIONS+=("$ver")
done

if [[ ${#NEW_VERSIONS[@]} -eq 0 ]]; then
  echo "$LOG_PREFIX Up to date. Analyzed: $(echo "$ANALYZED_VERSIONS" | tr '\n' ',')"
  exit 0
fi

echo "$LOG_PREFIX New versions: ${NEW_VERSIONS[*]}"

# ── Ensure gateway is running ─────────────────────────────────────────────────

if ! lsof -ti:8765 >/dev/null 2>&1; then
  if [[ ! -f "$GATEWAY_BIN" ]]; then
    echo "$LOG_PREFIX ERROR: gateway binary not found: $GATEWAY_BIN"
    exit 1
  fi
  echo "$LOG_PREFIX Starting gateway..."
  "$GATEWAY_BIN" >> /tmp/cc-gnothi-gateway.log 2>&1 &
  sleep 4
  if ! lsof -ti:8765 >/dev/null 2>&1; then
    echo "$LOG_PREFIX ERROR: gateway failed to start. See /tmp/cc-gnothi-gateway.log"
    exit 1
  fi
  echo "$LOG_PREFIX Gateway started (PID $(lsof -ti:8765 | head -1))"
fi

# ── Process each new version in sorted order ─────────────────────────────────

# Tracks how many new spec versions were successfully pushed in this run.
# If > 0 at the end, we auto-bump cc-gnothi-mcp's patch version and push a
# `v*` tag so release.yml builds release artifacts that embed the new spec.
PUSHED_COUNT=0

for i in "${!ALL_SORTED[@]}"; do
  ver="${ALL_SORTED[$i]}"
  is_analyzed "$ver" && continue

  # Find closest analyzed predecessor
  PREV_VER=""
  for j in $(seq $((i-1)) -1 0); do
    candidate="${ALL_SORTED[$j]}"
    if is_analyzed "$candidate"; then
      PREV_VER="$candidate"
      break
    fi
  done

  if [[ -z "$PREV_VER" ]]; then
    echo "$LOG_PREFIX WARN: v${ver} has no analyzed predecessor, skipping"
    continue
  fi

  # Dump prompt-type command bodies into versions/v${ver}/_raw/ so
  # analyze-all.sh can inject them into the analysis prompt. Failure is
  # non-fatal — analyze-all.sh just falls back to AST-only analysis.
  echo "$LOG_PREFIX Dumping prompt bodies for v${ver}..."
  node "$SCRIPT_DIR/extract-ast.js" --dump-prompts \
    --bundle "$ARTIFACTS_DIR/claude-${ver}.js" --version "$ver" \
    || echo "$LOG_PREFIX WARN: prompt body dump failed for v${ver}, continuing..."

  echo "$LOG_PREFIX Analyzing v${ver} (diff from v${PREV_VER})..."
  bash "$SCRIPT_DIR/analyze-all.sh" --version "$ver" --from-version "$PREV_VER" --depth 4

  echo "$LOG_PREFIX Analyzing system context for v${ver}..."
  bash "$SCRIPT_DIR/analyze-system-context.sh" --version "$ver" \
    || echo "$LOG_PREFIX WARN: system context analysis failed for v${ver}, continuing..."

  # Count committed-ready files and push
  SPEC_COUNT=$(find "$REPO_ROOT/versions/v${ver}" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$SPEC_COUNT" -gt 0 ]]; then
    git -C "$REPO_ROOT" add "versions/v${ver}/"
    git -C "$REPO_ROOT" commit -m "$(cat <<EOF
feat(docs): add v${ver} specs (${SPEC_COUNT} commands, diff from v${PREV_VER})

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
    git -C "$REPO_ROOT" push origin main
    ANALYZED_VERSIONS="${ANALYZED_VERSIONS}
${ver}"
    echo "$LOG_PREFIX Pushed v${ver} (${SPEC_COUNT} specs)"
    PUSHED_COUNT=$((PUSHED_COUNT + 1))
    tg_notify "🆕 cc-gnothi v${ver} 분석 완료 (${SPEC_COUNT} specs, diff from v${PREV_VER})"
  else
    echo "$LOG_PREFIX WARN: no specs generated for v${ver}"
  fi
done

# ── Auto-bump cc-gnothi-mcp + tag → trigger release.yml ──────────────────────
#
# Embedded specs change only when versions/v*/ files change, so cc-gnothi-mcp
# binaries published before this commit don't carry the new spec. We bump the
# patch version, push, then push the `v*` tag so the Release workflow rebuilds
# all 4-platform artifacts. The user's installed MCP picks them up via
# self-update on the next claude launch.

if [[ "$PUSHED_COUNT" -gt 0 ]]; then
  CARGO_TOML="$REPO_ROOT/src/Cargo.toml"
  CURRENT_MCP_VER=$(awk -F'"' '/^version =/ {print $2; exit}' "$CARGO_TOML")
  NEW_MCP_VER=$(echo "$CURRENT_MCP_VER" | awk -F. '{printf "%d.%d.%d", $1, $2, $3+1}')

  echo "$LOG_PREFIX Auto-bumping cc-gnothi-mcp ${CURRENT_MCP_VER} -> ${NEW_MCP_VER} (${PUSHED_COUNT} new spec)"
  sed -i '' "s/^version = \"${CURRENT_MCP_VER}\"$/version = \"${NEW_MCP_VER}\"/" "$CARGO_TOML"

  # Local build verifies the new spec embeds cleanly AND syncs Cargo.lock.
  # If this fails we abort the auto-release so we don't ship a broken binary;
  # the Cargo.toml edit stays on disk but isn't pushed (next manual run can fix).
  if (cd "$REPO_ROOT/src" && cargo build --release 2>&1 | tail -3); then
    git -C "$REPO_ROOT" add src/Cargo.toml src/Cargo.lock
    git -C "$REPO_ROOT" commit -m "chore: bump cc-gnothi-mcp to ${NEW_MCP_VER} (auto: ${PUSHED_COUNT} new spec)"
    git -C "$REPO_ROOT" push origin main
    git -C "$REPO_ROOT" tag "v${NEW_MCP_VER}"
    git -C "$REPO_ROOT" push origin "v${NEW_MCP_VER}"
    echo "$LOG_PREFIX Tagged v${NEW_MCP_VER} → release.yml will publish artifacts"
    tg_notify "📦 cc-gnothi-mcp v${NEW_MCP_VER} 자동 release 트리거 (${PUSHED_COUNT}개 새 spec)"
  else
    echo "$LOG_PREFIX ERROR: cargo build failed; skipping auto-release for ${NEW_MCP_VER}"
    tg_notify "⚠️ cc-gnothi-mcp v${NEW_MCP_VER} 자동 빌드 실패 — 수동 점검 필요"
    # Revert the Cargo.toml edit so the next run can retry cleanly
    sed -i '' "s/^version = \"${NEW_MCP_VER}\"$/version = \"${CURRENT_MCP_VER}\"/" "$CARGO_TOML"
  fi
fi

echo "$LOG_PREFIX DONE"
