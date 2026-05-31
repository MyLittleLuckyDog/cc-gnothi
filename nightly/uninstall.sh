#!/usr/bin/env bash
#
# nightly/uninstall.sh — remove the cc-gnothi nightly launchd job.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="${LAUNCHCTL_AGENT_DIR:-$HOME/Library/LaunchAgents}"
PLIST_NAME="com.cc-gnothi.nightly.plist"
PLIST_INSTALLED="$AGENT_DIR/$PLIST_NAME"
LABEL="com.cc-gnothi.nightly"

note() { printf '\033[36m▸\033[0m %s\n' "$*" >&2; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[33m⚠\033[0m %s\n' "$*" >&2; }

if [[ ! -f "$PLIST_INSTALLED" ]]; then
  warn "$PLIST_INSTALLED not present — nothing to uninstall"
  exit 0
fi

note "unloading $LABEL"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null \
  || launchctl unload -w "$PLIST_INSTALLED" 2>/dev/null \
  || warn "(launchctl reported the job wasn't loaded)"

note "removing $PLIST_INSTALLED"
rm -f "$PLIST_INSTALLED"

ok "uninstalled"

cat <<EOF >&2

Log files were kept (delete by hand if wanted):
  ~/Library/Logs/cc-gnothi-nightly.out.log
  ~/Library/Logs/cc-gnothi-nightly.err.log
EOF
