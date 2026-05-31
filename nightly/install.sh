#!/usr/bin/env bash
#
# nightly/install.sh — set up the cc-gnothi nightly launchd job.
#
# Run once on the target macOS host (mini-server). The script:
#
#   1. probes prerequisites (node, git, arbor — arbor is optional
#      and the handler-resolution pipeline gracefully SKIPs when
#      it's missing; the rest of analysis still runs).
#   2. detects the cc-gnothi repo root + sibling caludeCodeAVX2.
#   3. renders nightly/com.cc-gnothi.nightly.plist into
#      ~/Library/LaunchAgents/com.cc-gnothi.nightly.plist with
#      the @REPO_ROOT@ / @USER_HOME@ placeholders filled in.
#   4. launchctl-loads the job and prints how to verify / inspect
#      logs / uninstall.
#
# Idempotent: re-running on the same host re-installs cleanly
# (unloads any previous job, overwrites the plist, reloads).
#
# Usage:
#   ./nightly/install.sh                  # default (analysis-only)
#   ./nightly/install.sh --dry-run        # show what would happen
#
# Environment overrides:
#   CC_GNOTHI_REPO        repo root path (default: parent of this script's dir)
#   CALUDE_AVX2_REPO      caludeCodeAVX2 path (default: $CC_GNOTHI_REPO/../caludeCodeAVX2)
#   LAUNCHCTL_AGENT_DIR   override the install dir (default: ~/Library/LaunchAgents)

set -euo pipefail

# ── Paths ────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="${CC_GNOTHI_REPO:-$DEFAULT_REPO}"
AVX2_REPO="${CALUDE_AVX2_REPO:-$REPO_ROOT/../caludeCodeAVX2}"
AGENT_DIR="${LAUNCHCTL_AGENT_DIR:-$HOME/Library/LaunchAgents}"

PLIST_NAME="com.cc-gnothi.nightly.plist"
PLIST_TEMPLATE="$SCRIPT_DIR/$PLIST_NAME"
PLIST_INSTALLED="$AGENT_DIR/$PLIST_NAME"
LABEL="com.cc-gnothi.nightly"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# ── helpers ──────────────────────────────────────────────────────────────────

note()  { printf '\033[36m▸\033[0m %s\n' "$*" >&2; }
ok()    { printf '\033[32m✓\033[0m %s\n' "$*" >&2; }
warn()  { printf '\033[33m⚠\033[0m %s\n' "$*" >&2; }
fail()  { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '   $ %s\n' "$*" >&2
  else
    "$@"
  fi
}

# ── 1. Prerequisites ─────────────────────────────────────────────────────────

note "checking prerequisites"

if [[ "$(uname)" != "Darwin" ]]; then
  fail "this installer is macOS-only (launchd). Use systemd/cron on Linux."
fi

if ! command -v node >/dev/null 2>&1; then
  fail "node not found on PATH — install Node.js >= 18 (https://nodejs.org or 'brew install node')"
fi
NODE_VER="$(node --version | sed 's/^v//')"
NODE_MAJOR="${NODE_VER%%.*}"
if (( NODE_MAJOR < 18 )); then
  fail "node $NODE_VER too old; need >= 18"
fi
ok "node $NODE_VER"

if ! command -v git >/dev/null 2>&1; then
  fail "git not found on PATH"
fi
ok "git $(git --version | awk '{print $3}')"

if command -v arbor >/dev/null 2>&1; then
  ARBOR_VER="$(arbor --version 2>/dev/null | head -1 || echo 'unknown')"
  ok "arbor present ($ARBOR_VER) — handler-resolution will run"
else
  warn "arbor missing — handler-resolution pipeline will SKIP (analysis still completes)"
  warn "  install: https://github.com/MyLittleLuckyDog/Arbor-Vitae   (cargo install --git ...)"
  warn "  override path: set ARBOR_BIN env in $PLIST_INSTALLED after install"
fi

# ── 2. Repo layout ───────────────────────────────────────────────────────────

note "checking repo layout"

if [[ ! -d "$REPO_ROOT/.git" ]]; then
  fail "REPO_ROOT does not look like a git checkout: $REPO_ROOT"
fi
if [[ ! -f "$REPO_ROOT/scripts/sync-and-analyze.sh" ]]; then
  fail "$REPO_ROOT/scripts/sync-and-analyze.sh missing — wrong path?"
fi
ok "cc-gnothi repo: $REPO_ROOT"

if [[ ! -d "$AVX2_REPO/.git" ]]; then
  warn "caludeCodeAVX2 not found at $AVX2_REPO"
  warn "  clone it before the first nightly run, or set CALUDE_AVX2_REPO to its path"
else
  ok "caludeCodeAVX2 repo: $AVX2_REPO"
fi

if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  warn "node_modules missing in $REPO_ROOT — running 'npm install'"
  run bash -c "cd '$REPO_ROOT' && npm install --no-fund --no-audit --silent"
  ok "npm install complete"
else
  ok "node_modules present"
fi

# ── 3. Render plist ──────────────────────────────────────────────────────────

if [[ ! -f "$PLIST_TEMPLATE" ]]; then
  fail "plist template not found: $PLIST_TEMPLATE"
fi

note "rendering plist for this host"
run mkdir -p "$AGENT_DIR"
if [[ -f "$PLIST_INSTALLED" ]]; then
  note "previous install detected — unloading first"
  if launchctl list "$LABEL" >/dev/null 2>&1; then
    run launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null \
      || run launchctl unload -w "$PLIST_INSTALLED" 2>/dev/null \
      || true
  fi
fi

if [[ "$DRY_RUN" == "true" ]]; then
  printf '   $ sed -e ... %s > %s\n' "$PLIST_TEMPLATE" "$PLIST_INSTALLED" >&2
else
  sed \
    -e "s|@REPO_ROOT@|$REPO_ROOT|g" \
    -e "s|@USER_HOME@|$HOME|g" \
    "$PLIST_TEMPLATE" \
    > "$PLIST_INSTALLED"
fi
ok "installed: $PLIST_INSTALLED"

# Validate (only when actually written)
if [[ "$DRY_RUN" == "false" ]]; then
  if ! plutil -lint "$PLIST_INSTALLED" >/dev/null 2>&1; then
    fail "rendered plist failed plutil -lint: $PLIST_INSTALLED"
  fi
  ok "plist syntax valid"
fi

# ── 4. Load ──────────────────────────────────────────────────────────────────

note "loading into launchd"
run launchctl load -w "$PLIST_INSTALLED"
ok "loaded as label: $LABEL"

# ── 5. Verify ────────────────────────────────────────────────────────────────

note "verification"

if [[ "$DRY_RUN" == "false" ]]; then
  if launchctl list "$LABEL" >/dev/null 2>&1; then
    ok "launchctl list $LABEL — registered"
  else
    warn "launchctl list shows nothing for $LABEL — check Console.app"
  fi
fi

cat <<EOF >&2

──────────────────────────────────────────────────────────────────────
cc-gnothi nightly is installed.

Schedule:    03:00 local time, every day (wakes on next boot if asleep)
Log files:   ~/Library/Logs/cc-gnothi-nightly.out.log
             ~/Library/Logs/cc-gnothi-nightly.err.log

Trigger now (sanity check):
   launchctl start $LABEL
   tail -f ~/Library/Logs/cc-gnothi-nightly.out.log

Uninstall:
   $SCRIPT_DIR/uninstall.sh

The job runs scripts/sync-and-analyze.sh in analysis-only mode —
new specs land in the working tree but nothing is committed or
pushed. Wrap in a custom script (see nightly/README.md
"Auto-commit / auto-push") if you want unattended commit.
──────────────────────────────────────────────────────────────────────
EOF
