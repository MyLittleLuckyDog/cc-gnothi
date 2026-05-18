#!/usr/bin/env bash
# compare.sh — show command-level diff between two CC versions
# Usage:
#   ./compare.sh 2.1.132 2.1.133
#   ./compare.sh 2.1.141 2.1.142
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <from-version> <to-version>"
  exit 1
fi

FROM="$1"
TO="$2"
CACHE_DIR="${CC_GNOTHI_CACHE:-$HOME/.cc-gnothi/cache}"
FROM_FILE="$CACHE_DIR/hashes-${FROM}.json"
TO_FILE="$CACHE_DIR/hashes-${TO}.json"

if [[ ! -f "$FROM_FILE" ]]; then
  echo "ERROR: no hash cache for v${FROM} — run: node scripts/extract-ast.js --hash-commands --version $FROM" >&2
  exit 1
fi
if [[ ! -f "$TO_FILE" ]]; then
  echo "ERROR: no hash cache for v${TO} — run: node scripts/extract-ast.js --hash-commands --version $TO" >&2
  exit 1
fi

python3 - "$FROM_FILE" "$TO_FILE" "$FROM" "$TO" <<'PYEOF'
import json, sys

from_file, to_file, from_ver, to_ver = sys.argv[1:]

def load(path):
    d = json.load(open(path))
    return d.get('commands', d)

a, b = load(from_file), load(to_file)

changed = [(k, a[k], b[k]) for k in sorted(a) if k in b and a[k] != b[k]]
added   = [k for k in sorted(b) if k not in a]
removed = [k for k in sorted(a) if k not in b]
same    = sum(1 for k in a if k in b and a[k] == b[k])
total   = len(set(a) | set(b))

print(f"v{from_ver} → v{to_ver}  ({total} commands)")
print(f"  CHANGED  {len(changed)}")
print(f"  ADDED    {len(added)}")
print(f"  REMOVED  {len(removed)}")
print(f"  SAME     {same}")
print()

if changed:
    print("── CHANGED ──────────────────────────────")
    for k, h1, h2 in changed:
        print(f"  ~ /{k:<30}  {h1} → {h2}")
    print()

if added:
    print("── ADDED ────────────────────────────────")
    for k in added:
        print(f"  + /{k}")
    print()

if removed:
    print("── REMOVED ──────────────────────────────")
    for k in removed:
        print(f"  - /{k}")
    print()

if not changed and not added and not removed:
    print("No command-level changes detected.")
    print("(Bundle diff likely in non-command infrastructure code.)")
PYEOF
