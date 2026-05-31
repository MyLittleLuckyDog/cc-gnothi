#!/usr/bin/env bash
# batch-propagate.sh — chain analyze-all.sh --from-version across the version
# series with parallel ANALYZE per version.
#
# Usage:
#   ./scripts/batch-propagate.sh <start-ver> <end-ver> [parallel]
#
# Picks the adjacent (sorted) version pairs from versions/ and runs
# analyze-all.sh with --from-version pointing at the previous one.
# `start-ver` is the first version that gets analyzed; the version
# immediately before it (in sorted order) is used as its baseline.

set -uo pipefail

START_VER=${1:?usage: batch-propagate.sh <start-ver> <end-ver> [parallel=4]}
END_VER=${2:?}
PARALLEL=${3:-4}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Sorted list of all versions present under versions/.
mapfile -t ALL < <(ls "$REPO_ROOT/versions" | sed 's/^v//' | sort -V)

# Adjacent pairs (prev, curr) where curr lies inside [START..END].
PAIRS=()
for i in $(seq 1 $((${#ALL[@]} - 1))); do
  prev=${ALL[$((i-1))]}
  curr=${ALL[$i]}
  # only include if curr is within the requested window
  [[ "$(printf '%s\n%s' "$START_VER" "$curr" | sort -V | head -1)" == "$START_VER" ]] || continue
  [[ "$(printf '%s\n%s' "$curr" "$END_VER" | sort -V | tail -1)" == "$END_VER" ]] || continue
  PAIRS+=("$prev:$curr")
done

if [[ ${#PAIRS[@]} -eq 0 ]]; then
  echo "no pairs in range [$START_VER..$END_VER]"
  exit 1
fi

echo "═══ batch plan ($(date)) ═══"
for p in "${PAIRS[@]}"; do
  echo "  v${p#*:}  ←  v${p%:*}"
done
echo "  parallel = $PARALLEL"
echo "═══════════════════════════════════════════"

t0=$(date +%s)
for p in "${PAIRS[@]}"; do
  prev=${p%:*}
  curr=${p#*:}
  echo ""
  echo "═══ v$curr (--from-version v$prev) — $(date) ═══"
  if ! bash "$SCRIPT_DIR/analyze-all.sh" \
        --version "$curr" \
        --from-version "$prev" \
        --depth 4 \
        --parallel "$PARALLEL"; then
    echo "FAIL on v$curr — stopping batch"
    exit 1
  fi
done

t1=$(date +%s)
echo ""
echo "═══ Batch DONE in $((t1 - t0))s ═══"
