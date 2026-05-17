---
cc_version: "2.1.132"
build_time: "2026-05-06T17:56:43Z"
git_sha: "f9c2aef1b03555fabbb4ec60302d6750f2ff689e"
bundle_lines: 19279
bundle_size: "13.52 MB"
prev_version: "N/A"
generated: "2026-05-17"
---

# CC v2.1.132

## Bundle Metadata

| Field | Value |
|---|---|
| BUILD_TIME | 2026-05-06T17:56:43Z |
| GIT_SHA | `f9c2aef1b03555fabbb4ec60302d6750f2ff689e` |
| Bundle size | 13.52 MB / 19279 lines |
| Previous version | N/A |

## Command Changes (vs N/A)

| Command | Description | Change |
|---|---|---|
| `/add-dir` | Add a new working directory | added |
| `/advisor` | Configure the Advisor Tool to consult a stronger model for guidance at key moments during a task | added |
| `/agents` | Manage agent configurations | added |
| `/autocompact` | Configure the auto-compact window size | added |
| `/autofix-pr` | Monitor and autofix any issues with the current PR | added |
| `/bridge-kick` | Inject bridge failure states for manual recovery testing | added |
| `/brief` | Toggle brief-only mode | added |
| `/btw` | Ask a quick side question without interrupting the main conversation | added |
| `/clear` | Start a new session with empty context; previous session stays on disk (resumable with /resume) | added |
| `/color` | Set the prompt bar color for this session | added |
| `/compact` | Free up context by summarizing the conversation so far | added |
| `/copy` | Copy Claude's last response to clipboard (or /copy N for the Nth-latest) | added |
| `/daemon` | Manage background services: assistants, scheduled tasks, and remote control | added |
| `/diff` | View uncommitted changes and per-turn diffs | added |
| `/effort` | Set effort level for model usage | added |
| `/export` | Export the current conversation to a file or clipboard | added |
| `/extra-usage` | Configure extra usage to keep working when limits are hit | added |
| `/focus` | Toggle focus view (show only your prompt, a tool summary, and the final response) | added |
| `/fork` | Spawn a background agent that inherits the full conversation | added |
| `/goal` | Set a goal \u2014 keep working until the condition is met | added |
| `/heapdump` | Dump the JS heap to ~/Desktop | added |
| `/help` | Show help and available commands | added |
| `/hooks` | View hook configurations for tool events | added |
| `/ide` | Manage IDE integrations and show status | added |
| `/install` | Install Claude Code native build | added |
| `/install-github-app` | Set up Claude GitHub Actions for a repository | added |
| `/install-slack-app` | Install the Claude Slack app | added |
| `/logout` | Sign out from your Anthropic account | added |
| `/loops` | List, create, and delete recurring loops and stop-hooks | added |
| `/mcp` | Manage MCP servers | added |
| `/memory` | Edit Claude memory files | added |
| `/plan` | Enable plan mode or view the current session plan | added |
| `/powerup` | Discover Claude Code features through quick interactive lessons | added |
| `/privacy-settings` | View and update your privacy settings | added |
| `/pro-trial-expired` | Options shown when the Pro plan Claude Code trial has ended | added |
| `/radio` | Listen to Claude FM lo-fi radio | added |
| `/rate-limit-options` | Show options when rate limit is reached | added |
| `/recap` | Generate a one-line session recap now | added |
| `/reload-plugins` | Activate pending plugin changes in the current session | added |
| `/remote-env` | Configure the default remote environment for teleport sessions | added |
| `/resume` | Resume a previous conversation | added |
| `/setup-bedrock` | Reconfigure Amazon Bedrock authentication, region, or model pins | added |
| `/setup-vertex` | Reconfigure Google Vertex AI authentication, project, region, or model pins | added |
| `/skills` | List available skills | added |
| `/status` | Show Claude Code status including version, model, account, API connectivity, and tool statuses | added |
| `/stickers` | Order Claude Code stickers | added |
| `/stop` | Stop this background session; transcript and worktree are kept | added |
| `/teleport` | Resume a Claude Code session from claude.ai | added |
| `/theme` | Change the theme | added |
| `/toggle-memory` | Toggle automemory off/on for this session | added |
| `/tui` | Set the terminal UI renderer (default | fullscreen) | added |
| `/update` | Switch to the latest version (conversation continues) | added |
| `/upgrade` | Upgrade to Max for higher rate limits and more Opus | added |
| `/version` | Print the version this session is running (not what autoupdate downloaded) | added |
| `/voice` | Toggle voice mode | added |
| `/web-setup` | Setup Claude Code on the web (requires connecting your GitHub account) | added |


## All Slash Commands (v2.1.132)

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
| `/extra-usage` | Configure extra usage to keep working when limits are hit |
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
| `/version` | Print the version this session is running (not what autoupdate downloaded) |
| `/voice` | Toggle voice mode |
| `/web-setup` | Setup Claude Code on the web (requires connecting your GitHub account) |

## Feature Spec Documents

<!-- Populated by automation. Add entries here when a feature-spec file is complete. -->
- [add-dir.md](add-dir.md) — `/add-dir`: Add a new working directory (stub, analysis pending)
- [advisor.md](advisor.md) — `/advisor`: Configure the Advisor Tool to consult a stronger model for guidance at key moments during a task (stub, analysis pending)
- [agents.md](agents.md) — `/agents`: Manage agent configurations (stub, analysis pending)
- [autocompact.md](autocompact.md) — `/autocompact`: Configure the auto-compact window size (stub, analysis pending)
- [autofix-pr.md](autofix-pr.md) — `/autofix-pr`: Monitor and autofix any issues with the current PR (stub, analysis pending)
- [bridge-kick.md](bridge-kick.md) — `/bridge-kick`: Inject bridge failure states for manual recovery testing (stub, analysis pending)
- [brief.md](brief.md) — `/brief`: Toggle brief-only mode (stub, analysis pending)
- [btw.md](btw.md) — `/btw`: Ask a quick side question without interrupting the main conversation (stub, analysis pending)
- [clear.md](clear.md) — `/clear`: Start a new session with empty context; previous session stays on disk (resumable with /resume) (stub, analysis pending)
- [color.md](color.md) — `/color`: Set the prompt bar color for this session (stub, analysis pending)
- [compact.md](compact.md) — `/compact`: Free up context by summarizing the conversation so far (stub, analysis pending)
- [copy.md](copy.md) — `/copy`: Copy Claude's last response to clipboard (or /copy N for the Nth-latest) (stub, analysis pending)
- [daemon.md](daemon.md) — `/daemon`: Manage background services: assistants, scheduled tasks, and remote control (stub, analysis pending)
- [diff.md](diff.md) — `/diff`: View uncommitted changes and per-turn diffs (stub, analysis pending)
- [effort.md](effort.md) — `/effort`: Set effort level for model usage (stub, analysis pending)
- [export.md](export.md) — `/export`: Export the current conversation to a file or clipboard (stub, analysis pending)
- [extra-usage.md](extra-usage.md) — `/extra-usage`: Configure extra usage to keep working when limits are hit (stub, analysis pending)
- [focus.md](focus.md) — `/focus`: Toggle focus view (show only your prompt, a tool summary, and the final response) (stub, analysis pending)
- [fork.md](fork.md) — `/fork`: Spawn a background agent that inherits the full conversation (stub, analysis pending)
- [goal.md](goal.md) — `/goal`: Set a goal \u2014 keep working until the condition is met (stub, analysis pending)
- [heapdump.md](heapdump.md) — `/heapdump`: Dump the JS heap to ~/Desktop (stub, analysis pending)
- [help.md](help.md) — `/help`: Show help and available commands (stub, analysis pending)
- [hooks.md](hooks.md) — `/hooks`: View hook configurations for tool events (stub, analysis pending)
- [ide.md](ide.md) — `/ide`: Manage IDE integrations and show status (stub, analysis pending)
- [install.md](install.md) — `/install`: Install Claude Code native build (stub, analysis pending)
- [install-github-app.md](install-github-app.md) — `/install-github-app`: Set up Claude GitHub Actions for a repository (stub, analysis pending)
- [install-slack-app.md](install-slack-app.md) — `/install-slack-app`: Install the Claude Slack app (stub, analysis pending)
- [logout.md](logout.md) — `/logout`: Sign out from your Anthropic account (stub, analysis pending)
- [loops.md](loops.md) — `/loops`: List, create, and delete recurring loops and stop-hooks (stub, analysis pending)
- [mcp.md](mcp.md) — `/mcp`: Manage MCP servers (stub, analysis pending)
- [memory.md](memory.md) — `/memory`: Edit Claude memory files (stub, analysis pending)
- [plan.md](plan.md) — `/plan`: Enable plan mode or view the current session plan (stub, analysis pending)
- [powerup.md](powerup.md) — `/powerup`: Discover Claude Code features through quick interactive lessons (stub, analysis pending)
- [privacy-settings.md](privacy-settings.md) — `/privacy-settings`: View and update your privacy settings (stub, analysis pending)
- [pro-trial-expired.md](pro-trial-expired.md) — `/pro-trial-expired`: Options shown when the Pro plan Claude Code trial has ended (stub, analysis pending)
- [radio.md](radio.md) — `/radio`: Listen to Claude FM lo-fi radio (stub, analysis pending)
- [rate-limit-options.md](rate-limit-options.md) — `/rate-limit-options`: Show options when rate limit is reached (stub, analysis pending)
- [recap.md](recap.md) — `/recap`: Generate a one-line session recap now (stub, analysis pending)
- [reload-plugins.md](reload-plugins.md) — `/reload-plugins`: Activate pending plugin changes in the current session (stub, analysis pending)
- [remote-env.md](remote-env.md) — `/remote-env`: Configure the default remote environment for teleport sessions (stub, analysis pending)
- [resume.md](resume.md) — `/resume`: Resume a previous conversation (stub, analysis pending)
- [setup-bedrock.md](setup-bedrock.md) — `/setup-bedrock`: Reconfigure Amazon Bedrock authentication, region, or model pins (stub, analysis pending)
- [setup-vertex.md](setup-vertex.md) — `/setup-vertex`: Reconfigure Google Vertex AI authentication, project, region, or model pins (stub, analysis pending)
- [skills.md](skills.md) — `/skills`: List available skills (stub, analysis pending)
- [status.md](status.md) — `/status`: Show Claude Code status including version, model, account, API connectivity, and tool statuses (stub, analysis pending)
- [stickers.md](stickers.md) — `/stickers`: Order Claude Code stickers (stub, analysis pending)
- [stop.md](stop.md) — `/stop`: Stop this background session; transcript and worktree are kept (stub, analysis pending)
- [teleport.md](teleport.md) — `/teleport`: Resume a Claude Code session from claude.ai (stub, analysis pending)
- [theme.md](theme.md) — `/theme`: Change the theme (stub, analysis pending)
- [toggle-memory.md](toggle-memory.md) — `/toggle-memory`: Toggle automemory off/on for this session (stub, analysis pending)
- [tui.md](tui.md) — `/tui`: Set the terminal UI renderer (default | fullscreen) (stub, analysis pending)
- [update.md](update.md) — `/update`: Switch to the latest version (conversation continues) (stub, analysis pending)
- [upgrade.md](upgrade.md) — `/upgrade`: Upgrade to Max for higher rate limits and more Opus (stub, analysis pending)
- [version.md](version.md) — `/version`: Print the version this session is running (not what autoupdate downloaded) (stub, analysis pending)
- [voice.md](voice.md) — `/voice`: Toggle voice mode (stub, analysis pending)
- [web-setup.md](web-setup.md) — `/web-setup`: Setup Claude Code on the web (requires connecting your GitHub account) (stub, analysis pending)

## Chapter Proposals

<!-- Populated by automation when new commands are detected. -->
- [ ] `/add-dir` — Add a new working directory. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/advisor` — Configure the Advisor Tool to consult a stronger model for guidance at key moments during a task. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/agents` — Manage agent configurations. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/autocompact` — Configure the auto-compact window size. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/autofix-pr` — Monitor and autofix any issues with the current PR. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/bridge-kick` — Inject bridge failure states for manual recovery testing. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/brief` — Toggle brief-only mode. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/btw` — Ask a quick side question without interrupting the main conversation. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/clear` — Start a new session with empty context; previous session stays on disk (resumable with /resume). Review: absorb into existing chapter or create new feature-spec.
- [ ] `/color` — Set the prompt bar color for this session. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/compact` — Free up context by summarizing the conversation so far. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/copy` — Copy Claude's last response to clipboard (or /copy N for the Nth-latest). Review: absorb into existing chapter or create new feature-spec.
- [ ] `/daemon` — Manage background services: assistants, scheduled tasks, and remote control. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/diff` — View uncommitted changes and per-turn diffs. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/effort` — Set effort level for model usage. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/export` — Export the current conversation to a file or clipboard. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/extra-usage` — Configure extra usage to keep working when limits are hit. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/focus` — Toggle focus view (show only your prompt, a tool summary, and the final response). Review: absorb into existing chapter or create new feature-spec.
- [ ] `/fork` — Spawn a background agent that inherits the full conversation. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/goal` — Set a goal \u2014 keep working until the condition is met. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/heapdump` — Dump the JS heap to ~/Desktop. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/help` — Show help and available commands. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/hooks` — View hook configurations for tool events. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/ide` — Manage IDE integrations and show status. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/install` — Install Claude Code native build. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/install-github-app` — Set up Claude GitHub Actions for a repository. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/install-slack-app` — Install the Claude Slack app. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/logout` — Sign out from your Anthropic account. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/loops` — List, create, and delete recurring loops and stop-hooks. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/mcp` — Manage MCP servers. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/memory` — Edit Claude memory files. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/plan` — Enable plan mode or view the current session plan. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/powerup` — Discover Claude Code features through quick interactive lessons. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/privacy-settings` — View and update your privacy settings. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/pro-trial-expired` — Options shown when the Pro plan Claude Code trial has ended. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/radio` — Listen to Claude FM lo-fi radio. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/rate-limit-options` — Show options when rate limit is reached. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/recap` — Generate a one-line session recap now. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/reload-plugins` — Activate pending plugin changes in the current session. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/remote-env` — Configure the default remote environment for teleport sessions. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/resume` — Resume a previous conversation. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/setup-bedrock` — Reconfigure Amazon Bedrock authentication, region, or model pins. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/setup-vertex` — Reconfigure Google Vertex AI authentication, project, region, or model pins. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/skills` — List available skills. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/status` — Show Claude Code status including version, model, account, API connectivity, and tool statuses. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/stickers` — Order Claude Code stickers. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/stop` — Stop this background session; transcript and worktree are kept. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/teleport` — Resume a Claude Code session from claude.ai. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/theme` — Change the theme. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/toggle-memory` — Toggle automemory off/on for this session. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/tui` — Set the terminal UI renderer (default | fullscreen). Review: absorb into existing chapter or create new feature-spec.
- [ ] `/update` — Switch to the latest version (conversation continues). Review: absorb into existing chapter or create new feature-spec.
- [ ] `/upgrade` — Upgrade to Max for higher rate limits and more Opus. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/version` — Print the version this session is running (not what autoupdate downloaded). Review: absorb into existing chapter or create new feature-spec.
- [ ] `/voice` — Toggle voice mode. Review: absorb into existing chapter or create new feature-spec.
- [ ] `/web-setup` — Setup Claude Code on the web (requires connecting your GitHub account). Review: absorb into existing chapter or create new feature-spec.
