---
cc_version: "2.1.146"
build_time: "2026-05-20T01:47:26Z"
git_sha: "c900a8c71aa966a1a8bf14c49139d87fac9ae881"
bundle_lines: 23951
bundle_size: "14.41 MB"
prev_version: "2.1.145"
generated: "2026-05-31"
---

# CC v2.1.146

## Bundle Metadata

| Field | Value |
|---|---|
| BUILD_TIME | 2026-05-20T01:47:26Z |
| GIT_SHA | `c900a8c71aa966a1a8bf14c49139d87fac9ae881` |
| Bundle size | 14.41 MB / 23951 lines |
| Previous version | 2.1.145 |

## Command Changes (vs 2.1.145)

| Command | Description | Change |
|---|---|---|
| — | — | — |


## All Slash Commands (v2.1.146)

| Command | Description |
|---|---|
| `/add-dir` | Add a new working directory |
| `/advisor` | Configure the Advisor Tool to consult a stronger model for guidance at key moments during a task |
| `/agents` | Manage agent configurations |
| `/autocompact` | Configure the auto-compact window size |
| `/autofix-pr` | Monitor and autofix any issues with the current PR |
| `/bridge-kick` | Inject bridge failure states for manual recovery testing |
| `/brief` | Toggle brief-only mode |
| `/btw` | Ask a quick side question without interrupting the main conversation |
| `/clear` | Start a new session with empty context; previous session stays on disk (resumable with /resume) |
| `/color` | Set the prompt bar color for this session |
| `/compact` | Free up context by summarizing the conversation so far |
| `/copy` | Copy Claude's last response to clipboard (or /copy N for the Nth-latest) |
| `/daemon` | Manage background services: assistants, scheduled tasks, and remote control |
| `/diff` | View uncommitted changes and per-turn diffs |
| `/effort` | Set effort level for model usage |
| `/export` | Export the current conversation to a file or clipboard |
| `/extra-usage` | Renamed to /usage-credits |
| `/focus` | Toggle focus view (show only your prompt, a tool summary, and the final response) |
| `/fork` | Spawn a background agent that inherits the full conversation |
| `/goal` | Set a goal \u2014 keep working until the condition is met |
| `/heapdump` | Dump the JS heap to ~/Desktop |
| `/help` | Show help and available commands |
| `/hooks` | View hook configurations for tool events |
| `/ide` | Manage IDE integrations and show status |
| `/install` | Install Claude Code native build |
| `/install-github-app` | Set up Claude GitHub Actions for a repository |
| `/install-slack-app` | Install the Claude Slack app |
| `/logout` | Sign out from your Anthropic account |
| `/loops` | List, create, and delete recurring loops and stop-hooks |
| `/mcp` | Manage MCP servers |
| `/memory` | Edit Claude memory files |
| `/plan` | Enable plan mode or view the current session plan |
| `/powerup` | Discover Claude Code features through quick interactive lessons |
| `/privacy-settings` | View and update your privacy settings |
| `/pro-trial-expired` | Options shown when the Pro plan Claude Code trial has ended |
| `/radio` | Listen to Claude FM lo-fi radio |
| `/rate-limit-options` | Show options when rate limit is reached |
| `/recap` | Generate a one-line session recap now |
| `/reload-plugins` | Activate pending plugin changes in the current session |
| `/remote-env` | Configure the default remote environment for teleport sessions |
| `/resume` | Resume a previous conversation |
| `/scroll-speed` | Adjust mouse wheel scroll speed |
| `/setup-bedrock` | Reconfigure Amazon Bedrock authentication, region, or model pins |
| `/setup-vertex` | Reconfigure Google Vertex AI authentication, project, region, or model pins |
| `/skills` | List available skills |
| `/status` | Show Claude Code status including version, model, account, API connectivity, and tool statuses |
| `/stickers` | Order Claude Code stickers |
| `/stop` | Stop this background session; transcript and worktree are kept |
| `/teleport` | Resume a Claude Code session from claude.ai |
| `/theme` | Change the theme |
| `/toggle-memory` | Toggle automemory off/on for this session |
| `/tui` | Set the terminal UI renderer (default | fullscreen) |
| `/update` | Switch to the latest version (conversation continues) |
| `/upgrade` | Upgrade to Max for higher rate limits and more Opus |
| `/usage-credits` | Configure usage credits to keep working when you hit a limit |
| `/version` | Print the version this session is running (not what autoupdate downloaded) |
| `/voice` | Toggle voice mode |
| `/web-setup` | Setup Claude Code on the web (requires connecting your GitHub account) |

## Feature Spec Documents

<!-- Populated by automation. Add entries here when a feature-spec file is complete. -->
<!-- No new commands this version -->

## Chapter Proposals

<!-- Populated by automation when new commands are detected. -->
<!-- No new commands this version -->

## Handler Resolution (G3-B integration)

| Metric | Value |
|---|---:|
| Total commands | 99 |
| Handler resolved | **99 / 99 (100%)** |
| via direct byte-range (path 1) | 17 |
| via module_id follow (path 2) | 78 |
| via load_ident direct (path 3) | 4 |
| Unresolved | 0 |

Per-command detail: [`_handlers.json`](_handlers.json).
