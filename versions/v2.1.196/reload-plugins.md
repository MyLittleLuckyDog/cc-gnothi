---
type: feature-spec
feature: "reload-plugins"
cc_version: "2.1.196"
updated: "2026-06-30"
tags: ["reload-plugins", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.196 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/reload-plugins`

> Analysis basis: CC v2.1.196 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.196

---

## Overview

`/reload-plugins` applies pending plugin changes (plugins, skills, agents, and plugin MCP servers) to the currently running Claude Code session without requiring a full restart. The command introspects which active plugin cache entries would be stale after a reload and — unless `--force` is supplied — warns the user when clearing those caches would invalidate the current conversation context. When `--force` is passed it bypasses that warning and proceeds unconditionally.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `reload-plugins` |
| description | `Activate pending plugin changes in the current session` |
| argumentHint | `[--force]` |
| supportsNonInteractive | `false` |
| thinClientDispatch | `control-request` |
| module_id | `yec` |
| load_inline | `true` |
| loc_byte | `13003876` |
| loc_byte_end | `13004120` |
| loc_line | `9019` |
| arbor_handler.name | `YYf` |
| arbor_handler.fqn | `claude-2.1.196::YYf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.196 bundle.js:+13003876

---

## Input Branching

The command has four or more distinct runtime paths depending on `--force`, cache-impact presence, argument parsing results, and whether the reload succeeds or partially fails. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A([User invokes /reload-plugins]) --> B{Parse argument string}
    B -- contains '--force' --> C[Set forceFlag = true]
    B -- no '--force' --> D[Set forceFlag = false]
    C --> E[Compute cache-impact via cacheImpactChecker]
    D --> E
    E --> F{forceFlag = false AND\ncache impact detected?}
    F -- Yes --> G[Emit warning message referencing\n'--force' to proceed\nbundle.js:+13002459]
    G --> Z([Return — no reload performed])
    F -- No --> H[Trim raw argument string\nbundle.js:+13002960]
    H --> I[Resolve active-plugin scope\nfor each category: plugin · skill · agent · plugin MCP server\nbundle.js:+13002670]
    I --> J[Call refreshActivePlugins / pluginReloadOrchestrator\nbundle.js:+13003306]
    J --> K{All plugin loads succeeded?}
    K -- Full success --> L[Emit 'reload_plugins' telemetry event\nbundle.js:+13002625]
    L --> M[Return text result to user]
    K -- Partial failure --> N[Emit error-category detail\nbundle.js:+13002863]
    N --> M
    K -- Total failure --> O[Emit error response\nbundle.js:+13002863]
    O --> M
```

Analysis basis: CC v2.1.196 bundle.js:+13002960, +13002996, +13003028

---

## Behavioral Spec

### 1. Argument Parsing and Force-Flag Detection

```
async function reloadPluginsHandler(context, rawArgString):
    // bundle.js:+13002960
    trimmedArgs = rawArgString.trim()

    // bundle.js:+13002996, +13003011
    forceFlag = trimmedArgs includes "--force"
                OR trimmedArgs includes "force"
```

Analysis basis: CC v2.1.196 bundle.js:+13002960, +13002996, +13003011

---

### 2. Cache-Impact Check (Guard Before Reload)

Before any plugin cache is cleared the handler calls the cache-impact checker (`cacheImpactChecker`, bundle identifier `_ec` → resolves helper `V`). This routine inspects the current conversation state to determine whether clearing plugin caches would force the model to reprocess the whole conversation.

```
function cacheImpactChecker(appState):
    // bundle.js:+13003180, +13001868
    impact = computeCacheImpact(appState)
    emit telemetry: tengu_reload_plugins_cache_impact

    return impact   // truthy if reload would bust active cache
```

If `forceFlag` is `false` and `impact` is truthy, the handler returns a warning message referencing `"--force"` to let the user opt in explicitly (literal fragment: `"the whole conversation instead of using the cache. Run /reload-plugins --force to apply."` — Analysis basis: CC v2.1.196 bundle.js:+13002459).

Analysis basis: CC v2.1.196 bundle.js:+13003074, +13003180

---

### 3. Plugin-Category Scope Resolution

The handler resolves which plugin instances are currently active across four named categories. Each category label is a string constant found in the bundle:

| Category label | bundle.js location |
|---|---|
| `"plugin"` | bundle.js:+13002690 |
| `"skill"` | bundle.js:+13002721 |
| `"agent"` | bundle.js:+13002749 |
| `"plugin MCP server"` | bundle.js:+13002781 |

```
function resolveActiveScopeCategories(pluginRegistry):
    // bundle.js:+13002670 (GZ → yn)
    for each category in ["plugin", "skill", "agent", "plugin MCP server"]:
        activeEntries[category] = pluginRegistry.getActive(category)
    return activeEntries
```

The separator `" · "` (bundle.js:+13002808) is used when constructing the user-facing summary line joining category names.

Analysis basis: CC v2.1.196 bundle.js:+13002670

---

### 4. Plugin Reload Orchestration (`JTe`)

The primary reload orchestrator (bundle identifier `JTe`, reached via `YYf → JTe` at bundle.js:+13003306) performs the following steps:

```
async function pluginReloadOrchestrator(activeScope, context):
    // bundle.js:+12999545
    log("refreshActivePlugins: clearing all plugin caches")

    // Clear all plugin caches — bundle.js:+12999597 (ZPl)
    clearAllPluginCaches()

    // Reload installed plugins from disk — bundle.js:+12999603 (Ch)
    reloadInstalledPlugins()

    // Reload LSP manager and plugin MCP configs — bundle.js:+13000222 (KYf), +13000255 (zYf)
    reloadLspPlugins()
    reloadMcpPluginConfigs()

    // Collect results per category using reduce — bundle.js:+13000080, +13000105
    results = reduceResults(activeScope)

    // Emit session-level reload event — bundle.js:+13000652
    emit A2.emit("reload_plugins")

    return buildTextResult(results)
```

The sub-function that clears the installed-plugins cache logs `"Cleared installed plugins cache"` (bundle.js:+11339143) and emits `tengu_plugin_state_file_error` on read failures.

Analysis basis: CC v2.1.196 bundle.js:+13003306, +12999545

---

### 5. Plugin Load Result Assembly (`assemblePluginLoadResult` / `yUo`)

The load-result assembler (bundle identifier `yUo`, reached via `Nfo → yUo`) collects per-plugin outcomes and categorises them by outcome type. Relevant string constants found in the implementation:

| Outcome label | bundle.js location |
|---|---|
| `"plugin_load_all"` | +11428210 |
| `"plugin_load_total_failure"` | +11428228 |
| `"plugin_load_partial_failures"` | +11428297 |
| `"ineffective-disable"` (warning class) | +11428095 |

```
function assemblePluginLoadResult(loadResults, originalCwd, currentCwd):
    if originalCwd !== currentCwd:
        // bundle.js:+11428363
        log("assemblePluginLoadResult: originalCwd changed mid-scan; skipping side-effects (stale early-kick)")
        return earlyBailResult

    successes = loadResults.filter(r => r.status == "fulfilled")
    failures  = loadResults.filter(r => r.status == "rejected")

    if failures.length == 0:
        record("plugin_load_all")
    else if successes.length == 0:
        record("plugin_load_total_failure")
    else:
        record("plugin_load_partial_failures")

    return buildSummary(successes, failures)
```

Analysis basis: CC v2.1.196 bundle.js:+11427791, +11428210, +11428363

---

### 6. Plugin Source Resolution (`_Uo`)

The per-plugin resolution routine (bundle identifier `_Uo`) resolves each plugin entry against multiple settings layers, in priority order:

| Settings layer | bundle.js location |
|---|---|
| `"userSettings"` | +11407962 |
| `"flagSettings"` | +11407977 |
| `"policySettings"` | +11407992 |
| `"localSettings"` | +11408064 |

Known failure reasons surfaced to the user (all are string constants):

- `"marketplace-blocked-by-policy"` (+11406897)
- `"marketplace-not-found"` (+11407450)
- `"marketplace-load-failed"` (+11407642)
- `"cache-miss"` (+11407698)
- `"plugin-not-found"` (+11407736)
- `"plugin-not-installed"` (+11408298)
- `"unknown"` (+11408248)
- `"generic-error"` (+11408824)

Analysis basis: CC v2.1.196 bundle.js:+11405115, +11407962

---

### 7. MCP Server Config Discovery (`NX` / `Dfo`)

After plugin reload the MCP configuration layer (bundle identifiers `Dfo → NX`) rediscovers local MCP server configs. Key behaviour:

- Searches for `.mcp.json` files (bundle.js:+6768781) by walking parent directories.
- Loads configs from four scopes: `"project"` (+6768849), `"user"` (+6769307), `"local"` (+6769509), `"enterprise"` (+6769650).
- Marks servers as `"approved"` (+6771344) or `"pending"` (+6771371) based on prior user consent.
- Duplicate suppression: any server that is detected as a duplicate of an already-running server is tagged `"mcp-server-suppressed-duplicate"` (+6772314), with a grace limit of `3` attempts (+6772290) and a minimum of `2` retained copies (+6772388).

Analysis basis: CC v2.1.196 bundle.js:+6773246, +6773279, +6773303

---

### 8. Output Format

The final return value is a `text`-typed response (literal `"text"` at bundle.js:+13002938). The result string joins category summaries with `" · "` (bundle.js:+13002808). An `"error"` field (bundle.js:+13002863) is populated if any plugin failed to load.

If a plugin-category produces hook registrations, they are emitted under the label `"hook"` (bundle.js:+13003555). LSP server results appear under `"plugin LSP server"` (bundle.js:+13003614).

Analysis basis: CC v2.1.196 bundle.js:+13002938, +13003555, +13003614

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_reload_plugins_cache_impact` (bundle.js:+13001868); `tengu_plugin_state_file_error` (bundle.js:+11339322); `tengu_feature_ok` (bundle.js:+1028610); `tengu_feature_bad` (bundle.js:+1028677); `tengu_feature_sad` (bundle.js:+1028758) |
| Plugin cache cleared | All in-memory installed-plugin caches flushed; log line `"Cleared installed plugins cache"` emitted (bundle.js:+11339143) |
| MCP server configs | Re-read from `.mcp.json` files in project, user, local, and enterprise scopes (bundle.js:+6768781) |
| LSP manager | Plugin-contributed LSP configs reloaded via `KYf` (bundle.js:+13000222) |
| Plugin hook registrations | Hook callbacks re-registered unless `--safe-mode` flag is present; safe-mode skips hook registration with log `"Safe mode: skipping plugin hook registration"` (bundle.js:+5413542) |
| appState changes | `t.getAppState()` read at +13003074; updated skill index cache cleared via `e.clearSkillIndexCache` (+13602805) |
| Session event | `A2.emit("reload_plugins")` fired (bundle.js:+13000652) — notifies in-session listeners |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.196 | Initial analysis |

---

## Common Mistakes

1. **Omitting `--force` when the cache impact is non-zero.** The command will bail with a warning rather than reload. Pass `--force` explicitly if you want the reload to proceed even though it will invalidate the current conversation cache.
2. **Expecting the command to restart MCP servers from scratch.** `/reload-plugins` re-reads config and reconnects changed servers, but does not hard-kill and respawn servers whose configuration has not changed.
3. **Running in non-interactive mode.** `supportsNonInteractive` is `false`; the command is not available in `--non-interactive` / headless runs and will not be dispatched.
4. **Confusing `/reload-plugins` with a plugin-install command.** The command activates _pending_ changes already made to plugin configuration files; it does not download or install new plugins.
5. **Assuming safe-mode environments honour hook re-registration.** When the session was launched with `--safe-mode`, hook callbacks are intentionally skipped even after `/reload-plugins` runs successfully (bundle.js:+5413542).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `YYf` | Main handler for `/reload-plugins` (AsyncFunction) |
| `GA` | Cache-impact check helper, first call from handler |
| `ed` | Inner cache-check utility called by `GA` and directly by `YYf` |
| `$Fe` | Sub-function of `ed` |
| `GZ` | Plugin-category scope resolver |
| `yn` | Plugin-registry accessor called by `GZ` |
| `Hec` | MCP/LSP server filter (checks presence in active-server sets) |
| `Dfo` | MCP config discovery driver |
| `OCe` | Sub-routine of `Dfo` |
| `Nfo` | Plugin load initiator |
| `yUo` | Plugin load result assembler |
| `_Uo` | Per-plugin source resolver (settings-layer lookup) |
| `NX` | MCP server set builder / dedup logic |
| `fc` | File-system helper used in MCP config loading |
| `v2` | Object-creation helper |
| `wT` | Project-level `.mcp.json` config loader |
| `Mde` | MCP server descriptor builder |
| `JS` | Array-type filter utility |
| `YLn` | Transport-type classifier (`http`, `dynamic`) |
| `pE` | Plugin-install check utility |
| `_Bn` | MCP binary download/extract helper |
| `Ect` | Shared error-classification helper |
| `wx` | MCP duplicate-suppression routine |
| `_0a` | Config-key deduplication map builder |
| `w` | Blur/focus time-tracking helper |
| `p` | Forced-shutdown helper |
| `M` | OAuth/HTTP gateway server handler (large multi-purpose module) |
| `r` | Data-forwarding helper |
| `vs` | Process-exit signalling helper |
| `n` | toLower-case normaliser |
| `i` | Connection close helper |
| `s` | Abort-set tracker |
| `xO` | Parallel context config reader |
| `f9t` | Context-level config parser |
| `w4e` | HIPAA/standard context selector |
| `cao` | `auto:N` context parser |
| `aup` | `auto`/`tst-auto` prefix checker |
| `ct` | Boolean-flag stringifier ("yes"/"on") |
| `_l` | Boolean-flag stringifier ("no"/"off") |
| `Hr` | Provider-type classifier (gateway, bedrock, etc.) |
| `Rm` | Provider name resolver |
| `Su` | Sub-provider resolver |
| `Trt` | Inner sub-provider helper |
| `aX` | Context-string normaliser |
| `cup` | Context lookup / iterative resolver |
| `it` | Context registry accessor |
| `Jy` | Output-token extractor |
| `_ec` | Cache-impact reporter (emits `tengu_reload_plugins_cache_impact`) |
| `V` | Feature-flag state accessor |
| `JYf` | Argument string splitter |
| `JTe` | Full plugin reload orchestrator |
| `ZPl` | Plugin-cache clearing sub-function |
| `Ch` | Installed-plugin reload sub-orchestrator |
| `OMf` | Plugin hook/component loader |
| `Uw` | Hook-set executor |
| `Qtr` | Hook-queue drain helper |
| `rnr` | Hook-registration routine |
| `uFn` | Hook-filter utility |
| `Nco` | Plugin-root collector |
| `Re` | Error push/log helper |
| `hBn` | Hook boundary helper |
| `KNo` | Known-hook validator |
| `NPl` | Plugin pipeline helper |
| `X0` | Skill-index cache clear coordinator |
| `eW` | Skill-index cache clear executor |
| `TPl` | Plugin timeline helper |
| `dze` | Plugin job helper |
| `QW` | Hook refresh coordinator |
| `zio` | Zero-IO plugin helper |
| `EG` | Tool-search cache clear (`XYt.clear`) |
| `nil` | Null/no-op plugin result |
| `sUa` | Session-update accumulator |
| `dr` | Debug/trace logger |
| `g0` | Logger bootstrap |
| `uoe` | Plugin config file reader |
| `kq` | File-extension checker (`.mcpb`, `.dxt`) |
| `lle` | Plugin listing helper |
| `Sfo` | Plugin config JSON file loader |
| `qt` | Platform path helper |
| `Sn` | ENOENT error classifier |
| `Gt` | Safe JSON parser |
| `o0a` | Plugin config directory scanner |
| `R5t` | MCPB archive extractor |
| `he` | String coercion utility |
| `Tje` | LSP config file loader (`.lsp.json`) |
| `pDp` | LSP path validator and reader |
| `dDp` | LSP relative-path resolver |
| `l` | Async task scheduler / async-store accessor |
| `eoc` | Daemon status file logger |
| `Zte` | Timestamp formatter |
| `Ks` | Async-store getter |
| `HZt` | Daemon status path builder |
| `Me` | JSON stringifier wrapper |
| `c` | Coroutine/yield helper |
| `i9n` | LSP extension-conflict deduplicator |
| `a` | Spend-blocked/billing error HTTP handler |
| `kge` | JSON stringify with replacer |
| `KYf` | LSP plugin reload collector |
| `hec` | LSP-manager set tracker |
| `zYf` | MCP plugin config reload collector |
| `sSe` | Safe-mode hook-skip guard |
| `Rl` | Platform capability reader |
| `lan` | Safe-mode flag accessor |
| `ITe` | Plugin dependency resolver and loader |
| `zD` | Known-marketplaces file reader |
| `rm` | Plugin marketplace JSON reader |
| `lnr` | Marketplace file path builder |
| `z6e` | Plugin descriptor entry mapper |
| `fn` | Plugin load function dispatcher |
| `Bgn` | Plugin bundle loader |
| `I3` | Plugin module loader |
| `gD` | Plugin validation error factory |
| `Xo` | Plugin name/path splitter |
| `Eb` | Plugin type classifier |
| `x9n` | URL scheme parser |
| `Pft` | Plugin allowlist checker |
| `X6t` | Plugin allowlist entry resolver |
| `j1a` | Path-pattern matcher |
| `V1a` | Wildcard path matcher |
| `aPp` | Plugin source type dispatch |
| `VG` | Plugin allowlist entry builder |
| `q1a` | Plugin graph edge checker |
| `Lkt` | URL-scheme validator (http/https) |
| `W1a` | Plugin version-range resolver |
| `ej` | Plugin manifest reader |
| `sJt` | Plugin `.claude-plugin/marketplace.json` reader |
| `ZNo` | Plugin marketplace JSON parser |
| `rn` | Filesystem error handler |
| `Ok` | Plugin config reader combining manifest + marketplace |
| `tUo` | Plugin combined config loader |
| `y9f` | Installed-plugin presence checker |
| `gJt` | Core plugin-state manager (large; orchestrates all plugin lifecycle) |
| `zw` | Plugin name builder |
| `ynr` | Plugin name+path resolver |
| `WBe` | Local-source prefix checker (`"./"`) |
| `u` | Daemon stop / signal helpers |
| `xe` | `tengu_feature_ok` emitter |
| `ke` | `tengu_feature_bad` emitter |
| `$F` | Feature-flag write helper |
| `Wj` | Race/abort signal helper |
| `Ot` | Async-context task runner |
| `tmn` | Task-store getter |
| `eM` | Plugin settings loader from disk |
| `nUo` | Plugin settings sync-reader |
| `rUo` | Plugin settings entry mapper |
| `cJt` | Plugin settings state accessor |
| `y` | Plugin connection slot map |
| `lqe` | Teammate mailbox helper |
| `EO` | Plugin name validator |
| `q0` | Name-validation helper |
| `BOn` | Semver validity checker |
| `E` | MCP SDK connection handler |
| `$Ct` | SSE transport factory |
| `er` | Error string factory |
| `EXi` | Plugin dependency-graph walker |
| `sT` | Plugin override set tracker |
| `NFe` | Plugin-name normaliser |
| `H` | Worker-process pool |
| `P` | Plugin-pipeline entry |
| `D` | Plugin-write dispatcher |
| `d` | Daemon worker supervisor |
| `N` | Daemon write helper |
| `qqc` | Real-path / stat helper |
| `_d` | Daemon yield helper |
| `k9m` | Daemon kernel-signal helper |
| `pOl` | Plugin ordered-load list manager |
| `k` | File-watcher / scheduled-task runner |
| `hXo` | Scheduled-task lock file writer |
| `mrn` | Scheduled-task lock file cleaner |
| `FEe` | Scheduled-task path builder |
| `O` | Background-session sweep coordinator |
| `I` | Terminal input handler |
| `h` | Background-worker pool manager |
| `no` | Plugin module dynamic importer |
| `Lg` | Plugin loader initialiser |
| `CDr` | Plugin settings writer |
| `nw` | Settings-change notifier |
| `MMr` | Settings timestamp recorder |
| `VBe` | Plugin config validator |
| `mkt` | Atomic file write helper |
| `n_` | Cache/registry clear helper |
| `Gvs` | Gitignore-append helper |
| `X5` | Settings path builder |
| `wt` | `tengu_feature_sad` emitter |
| `O8` | Settings load-event emitter |
| `Enr` | Plugin path traversal guard |
| `j` | Idle-exit timer |
| `ge` | MCP server connection slot set |
| `gc` | UUID generator |
| `tse` | MCP notification dispatcher |
| `Ts` | MCP tool-list publisher |
| `Rt` | Runtime logger |
| `fe` | MCP server active-connection map |
| `Le` | QR / status display manager |
| `Ce` | Abort controller wrapper |
| `ye` | OAuth token store |
| `vts` | OAuth token helper |
| `VHr` | Token-version helper |
| `wBt` | Plugin version-range validator |
| `wno` | Version-range null check |
| `hnr` | Plugin git-subdir helper |
| `fUo` | Plugin file-URL builder |
| `pJt` | Plugin path-to-fileURL converter |
| `_nr` | Plugin git remote resolver |
| `TDf` | Plugin git-resolve timeout helper |
| `Pn` | Plugin async-context guard |
| `oq` | Git credential helper |
| `Hnr` | Plugin git path rewriter |
| `mJt` | Plugin installation pipeline |
| `VSt` | Plugin installer (unsupported-source guard) |
| `unr` | Plugin compile-step helper |
| `gOl` | Plugin output-dir helper |
| `Vse` | Plugin hash builder |
| `a$` | Plugin target-path resolver |
| `mnr` | Plugin readdir / lockfile checker |
| `fnr` | Plugin build-artifact locator |
| `$K` | Plugin binary wrapper |
| `dNe` | Plugin post-install hook |
| `tnr` | Plugin temp-dir cleaner |
| `oUo` | Plugin ordered-list updater |
| `q` | Plugin permission map |
| `Y` | Plugin allow-entry builder |
| `z` | MCP connection state tracker |
| `_hr` | MCP apply-connection-result handler |
| `Sje` | MCP slot metadata builder |
| `W` | MCP connection pair |
| `K` | Keyboard-event filter |
| `Ye` | SIGINT / QR / display event handler |
| `Oe` | Display-update helper |
| `oe` | MCP server batch-connect coordinator |
| `A` | HTTP userinfo fetcher |
| `wVt` | MCP server warm-connect helper |
| `Zhm` | MCP server elicitation-type mapper |
| `le` | MCP elicitation cancel-set |
| `ue` | MCP tools/list-changed handler |
| `Se` | MCP active-server set |
| `ln` | MCP debug logger |
| `qe` | Display-render helper |
| `$r` | OAuth promise chain |
| `Nn` | Display-render duplicate of `qe` |
| `J5` | Watcher-list helper |
| `IDf` | Plugin dependency re-resolution helper |
| `we` | MCP connection-set manager (reconnect + send) |
| `ar` | MCP server registry |
| `Fn` | MCP server name set |
| `Jo` | MCP connection cleanup |
| `WPa` | MCP server batch-connect executor |
| `Fo` | MCP server capability logger |
| `Eo` | Session-type classifier |
| `J9` | MCP server name prefix validator |
| `$fa` | VSCode session detector |
| `A$n` | Plugin cross-reference builder |
| `_X` | Plugin cross-reference entry |
| `oKl` | MCP message JSON serialiser |
| `o4c` | CCD session config reader |
| `Z` | Conversation file reader/writer |
| `Qse` | Conversation file lstat reader |
| `WBl` | Conversation file unlink helper |
| `X` | Voice input session manager |
| `wmr` | Voice timing recorder |
| `ce` | Scroll/key event accumulator |
| `zwc` | Voice amplitude normaliser |
| `kr` | Plugin O8 wrapper |
| `aQe` | Locale/language resolver |
| `ccs` | Date-time formatter |
| `ccr` | Voice-stream WebSocket manager |
| `wIm` | Voice interim-text handler |
| `be` | MCP elicitation UI handler |
| `pe` | Voice session state machine |
| `DYo` | Voice audio-device selector |
| `ee` | Conversation slot getter |
| `K0` | Plugin name case-normaliser |
| `lg` | Line-drawing helper |
| `Jc` | OTEL metric emitter |
| `W6e` | OTEL resource-attribute builder |
| `BFe` | OTEL event batcher |
| `ZEr` | OTEL event serialiser |
| `eSr` | OTEL event sender |
| `re` | Voice session triple-state holder |
| `Nue` | Plugin dependency-name joiner |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.