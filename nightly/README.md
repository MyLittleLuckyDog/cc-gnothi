# cc-gnothi nightly — launchd setup

Schedules `scripts/sync-and-analyze.sh` on a macOS mini-server (or
any always-on mac) so newly-published CC bundles get pulled,
analyzed, and have their `_handlers.json` regenerated (via the
G3-B arbor pipeline) without manual invocation.

The repository's GitHub Actions workflow handles release builds
only — it doesn't run analyze-new-version.js. Nightly analysis
runs on whatever mac you point the launchd plist at.

## Prerequisites on the target mac

- `node >= 18` (homebrew or nodejs.org)
- `git` (Xcode CLT or homebrew)
- `arbor` from
  [MyLittleLuckyDog/Arbor-Vitae](https://github.com/MyLittleLuckyDog/Arbor-Vitae)
  installed at `~/.cargo/bin/arbor` (or set `ARBOR_BIN` env var).
  The handler-lookup pipeline gracefully **SKIPs** when arbor is
  absent — the rest of the per-version analysis still completes.
- `caludeCodeAVX2` checked out as a sibling of `cc-gnothi` (the
  bundle source). `sync-and-analyze.sh` does the read-only pull.
- A user SSH key with read access to both repos, registered with
  `ssh-agent` via macOS keychain so git can authenticate without
  a TTY.

## Install

```bash
# 1. Clone cc-gnothi + sibling caludeCodeAVX2 if you haven't.
mkdir -p ~/code
cd ~/code
git clone git@github.com:MyLittleLuckyDog/cc-gnothi.git
git clone git@github.com:MyLittleLuckyDog/caludeCodeAVX2.git

# 2. Run the installer (handles prereq check, npm install, plist
#    render with this host's $HOME, launchctl load, and verify).
cd cc-gnothi
./nightly/install.sh
```

The installer probes node ≥ 18, git, and `arbor` (the
last is optional — handler resolution gracefully SKIPs when
absent), renders the plist with the right `@REPO_ROOT@` /
`@USER_HOME@` substitutions, loads it via `launchctl`, and
prints the verification + log paths. It's idempotent: re-running
on the same host unloads any previous job before installing
fresh, so you can re-run it after pulling a new cc-gnothi
release without manually unloading first.

Override paths when the layout is non-default:

```bash
CC_GNOTHI_REPO=/path/to/cc-gnothi \
CALUDE_AVX2_REPO=/path/to/caludeCodeAVX2 \
./nightly/install.sh
```

Use `--dry-run` to preview without touching launchctl or
filesystem state.

### Manual install (without the script)

If you'd rather render the plist by hand:

```bash
mkdir -p ~/Library/LaunchAgents
sed \
    -e "s|@REPO_ROOT@|$HOME/code/cc-gnothi|g" \
    -e "s|@USER_HOME@|$HOME|g" \
    nightly/com.cc-gnothi.nightly.plist \
    > ~/Library/LaunchAgents/com.cc-gnothi.nightly.plist
launchctl load -w ~/Library/LaunchAgents/com.cc-gnothi.nightly.plist
launchctl list | grep cc-gnothi
```

After install, the job fires at **03:00 local time** every day
(or on the next wake if the mac is asleep at 03:00). Outputs go
to:

- `~/Library/Logs/cc-gnothi-nightly.out.log`
- `~/Library/Logs/cc-gnothi-nightly.err.log`

## Manual fire (sanity check before waiting overnight)

```bash
launchctl start com.cc-gnothi.nightly
# then tail the log
tail -f ~/Library/Logs/cc-gnothi-nightly.out.log
```

## Auto-commit / auto-push (opt-in)

The default plist runs **analysis only** — new
`_handlers.json` and updated `_index.md` files land in the
working tree, but **nothing is committed or pushed**. The user
reviews changes the next time they open the repo and commits by
hand.

If you want fully-unattended commit + push, wrap
`sync-and-analyze.sh` in a script that handles git itself:

```bash
#!/usr/bin/env bash
# nightly/auto-commit-wrapper.sh   (you create this; not shipped)
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/sync-and-analyze.sh
if ! git diff --quiet HEAD; then
  git add -A versions/
  git commit -m "chore(handlers): nightly backfill $(date -Iseconds)"
  git push origin main
fi
```

…then point the plist's `ProgramArguments` at the wrapper. Two
considerations before doing this:

- The mini-server's git identity needs push access; either an
  SSH key registered as a deploy key with write access, or a
  `gh auth login` session whose credential helper landlords
  HTTPS pushes.
- Auto-push means a regression in the parser silently corrupts
  the tracked specs. Prefer manual commit unless you actively
  monitor the log.

## Uninstall

```bash
./nightly/uninstall.sh
```

Or, manually:

```bash
launchctl unload -w ~/Library/LaunchAgents/com.cc-gnothi.nightly.plist
rm ~/Library/LaunchAgents/com.cc-gnothi.nightly.plist
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Job never fires | mac was asleep at 03:00 and never woke | Add a `pmset schedule` wake event, or pick a time when the machine is awake |
| `arbor: command not found` in stderr log | `~/.cargo/bin` not in launchd's PATH | Edit the `PATH` entry in the plist; unload & reload |
| `node: command not found` | homebrew path missing | Same as above (`/opt/homebrew/bin` on Apple Silicon, `/usr/local/bin` on x86) |
| Git pull fails | SSH-agent not present in launchd | Use `ssh-add --apple-use-keychain` on first login so the key persists |
| Handler-resolution always SKIP | arbor missing | Install per the [Arbor-Vitae README](https://github.com/MyLittleLuckyDog/Arbor-Vitae), or set `ARBOR_BIN=/path/to/arbor` in the plist's EnvironmentVariables |

## Why launchd, not cron?

macOS `cron` is deprecated and won't survive a fresh OS install.
`launchd` is the supported scheduler, integrates with the mac
power-management subsystem (sleep-aware), and ships with the OS.
