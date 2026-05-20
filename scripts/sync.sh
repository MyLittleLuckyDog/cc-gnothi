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

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/sbin:$PATH"

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
    tg_notify "🆕 cc-gnothi v${ver} 분석 완료 (${SPEC_COUNT} specs, diff from v${PREV_VER})"
  else
    echo "$LOG_PREFIX WARN: no specs generated for v${ver}"
  fi
done

echo "$LOG_PREFIX DONE"
