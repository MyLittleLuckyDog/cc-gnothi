---
type: feature-spec
feature: "reload-plugins"
cc_version: "2.1.141"
updated: "2026-05-31"
tags: ["reload-plugins", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.141 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/reload-plugins`

> Analysis basis: CC v2.1.141 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.141

---

## Overview

The `/reload-plugins` command activates pending plugin changes in the current session without restarting Claude Code. It works by clearing all plugin-related caches, sending a control request to the daemon, re-discovering and reinitializing every plugin type (plugin, skill, agent, plugin MCP server, LSP server), and then reporting the resulting plugin states back to the user as a formatted text message. The command is dispatched as a `control-request` in thin-client mode and requires an interactive session.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `reload-plugins` |
| description | `Activate pending plugin changes in the current session` |
| loc_byte | `11447066` |
| loc_byte_end | `11447285` |
| loc_line | `7156` |
| supportsNonInteractive | `false` |
| thinClientDispatch | `"control-request"` |
| module_id | `LWq` |
| load_inline | `true` |
| arbor_handler.name | `cI7` |
| arbor_handler.fqn | `claude-2.1.141::cI7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.141 bundle.js:+11447066

---

## Input Branching

The command's handler (`cI7`) branches across five distinct paths based on plugin type category, with an overarching error path. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A[/reload-plugins invoked] --> B[Send control-request to daemon\ncI7 → A.sendControlRequest\nbundle.js:+11446126]
    B --> C[Clear all plugin caches\ncI7 → AJH\nbundle.js:+11446497]
    C --> D[refreshActivePlugins: clearing all plugin caches\nbundle.js:+11444179]
    D --> E[Discover installed plugins\nAJH → Di\nbundle.js:+11444483]
    E --> F{Plugin type?}
    F --> G[plugin\nbundle.js:+11446221]
    F --> H[skill\nbundle.js:+11446252]
    F --> I[agent\nbundle.js:+11446280]
    F --> J[plugin MCP server\nbundle.js:+11446312]
    F --> K[LSP server\nbundle.js:+11446804]
    G & H & I & J & K --> L[Re-initialize and register servers\nAJH → Promise.all\nbundle.js:+11444286]
    L --> M{Any errors?}
    M -- Yes --> N[Collect error entries\nkind: error\nbundle.js:+11446394]
    M -- No --> O[Format plugin status lines\nAJH → dI7\nbundle.js:+11444836]
    N --> O
    O --> P[Return text response\nkind: text\nbundle.js:+11446469]
    P --> Q[Register hook and LSP server entries\ncI7 → GLH\nbundle.js:+11446529]
    Q --> R[Emit notification via formatPluginStatus\ncI7 → nt\nbundle.js:+11446572]
```

---

## Behavioral Spec

### 1. Entry Point and Control-Request Dispatch

The handler `cI7` (AsyncFunction, resolved via `module_id` path) is the primary entry point.

```
async function reloadPluginsHandler(context):
    // Emit a control-request event to the daemon
    sendControlRequest(context)                  // A.sendControlRequest  bundle.js:+11446126

    // Retrieve current plugin registry state
    pluginRegistry = getPluginRegistry()         // Ad → b8              bundle.js:+11446201

    // Kick off the full plugin refresh pipeline
    result = await refreshActivePlugins(context, pluginRegistry)
                                                 // AJH                  bundle.js:+11446497

    // Register server-level hooks and plugin entries
    registerPluginHooksAndServers(result)        // GLH                  bundle.js:+11446529

    // Produce the formatted status notification
    return formatPluginStatusNotification(result) // nt                  bundle.js:+11446572
```

Analysis basis: CC v2.1.141 bundle.js:+11446089

---

### 2. Cache Clearing (`refreshActivePlugins`)

Before re-discovering plugins, the pipeline unconditionally clears every plugin-related cache.

```
async function refreshActivePlugins(context, registry):
    log("refreshActivePlugins: clearing all plugin caches")
                                                 // bundle.js:+11444179
    clearInstalledPluginsCache()                 // Vs1 → v; logs "Cleared installed plugins cache"
                                                 // bundle.js:+11444231, bundle.js:+9287363
    clearPluginMiscCaches()                      // y3 → vA7, eHH, dz_, sz_, TrH
                                                 // bundle.js:+11444237
    clearLSPConfig()                             // FS1                  bundle.js:+11444242
    clearPolicyContext()                         // pX                   bundle.js:+11444260
    clearXBCache()                               // XB1                  bundle.js:+11444265

    // Re-discover all installed plugins in parallel
    installedPlugins = await discoverInstalledPlugins(context)
                                                 // Di                   bundle.js:+11444483

    return installedPlugins
```

Analysis basis: CC v2.1.141 bundle.js:+11444179

---

### 3. Plugin Discovery (`discoverInstalledPlugins`)

Plugin discovery reads multiple source formats from the filesystem.

```
async function discoverInstalledPlugins(context):
    results = []

    // Read .mcp.json configuration files
    mcpConfigs = await readMcpJsonFiles(context)    // i0_   bundle.js:+7529073
                                                    // reads utf-8 files bundle.js:+7529131

    // Identify .mcpb and .dxt archive plugins
    archivePlugins = await scanArchivePlugins(context) // Vg   bundle.js:+7528577
                                                       // checks .mcpb  bundle.js:+4977394
                                                       // checks .dxt   bundle.js:+4977415

    // Resolve plugin states (download, manifest, extract)
    resolvedPlugins = await resolvePluginStates(archivePlugins) // kZ1  bundle.js:+7527482

    // Read LSP .lsp.json configuration files
    lspConfigs = await readLSPConfigs(context)      // TIH   bundle.js:+11444644
                                                    // reads .lsp.json  bundle.js:+8326375

    return combineAll(mcpConfigs, resolvedPlugins, lspConfigs)
```

The `.mcpb` archive handler (`i$6`) performs manifest.json extraction (literal `"manifest.json"` at bundle.js:+4983414), MD5 content hashing (literal `"md5"` at bundle.js:+4984251, `"hex"` at bundle.js:+4984275), and sets state `"needs-config"` when configuration is required (bundle.js:+4983757).

Analysis basis: CC v2.1.141 bundle.js:+7528454

---

### 4. Plugin State Registration (`registerPluginHooksAndServers`)

After discovery, the handler registers all found plugins against the runtime registry and daemon.

```
async function registerPluginHooksAndServers(resolvedPlugins):
    // For each resolved plugin, determine type and register accordingly
    for plugin in resolvedPlugins:
        type = plugin.type    // one of: "plugin", "skill", "agent",
                              // "plugin MCP server", "plugin LSP server"
                              // bundle.js:+11446221, +11446252, +11446280,
                              //          +11446312, +11446804

        if type == "lsp-manager" or starts-with "plugin:":
                              // bundle.js:+11445657, +11445692
            registerLSPEntry(plugin)             // GLH → iJ7  bundle.js:+10666245

        // Register hook entries (type "hook")
        if type == "hook":                       // bundle.js:+11446745
            registerHookEntry(plugin)            // GLH → e$6  bundle.js:+10666262

    // Aggregate plugin statuses: dependency-resolution errors,
    // not-found entries, dependency-unsatisfied entries
    // bundle.js:+10665360, +10665397
    aggregateErrors(resolvedPlugins)             // GLH → vg   bundle.js:+10665586

    // Emit plugin status event
    emitPluginStatusEvent()                      // GLH → xj8.emit via AJH
                                                 // bundle.js:+11445241
```

Analysis basis: CC v2.1.141 bundle.js:+11446529

---

### 5. Plugin Status Formatting and Response

The final output is produced by two cooperating functions.

```
function formatPluginStatusNotification(plugins):
    lines = []

    // Build a status entry per plugin
    // Each entry is separated by " · "  (bundle.js:+11446339)
    for plugin in plugins:
        statusLine = buildStatusLine(plugin)     // dI7  bundle.js:+11444836
        lines.push(statusLine)

    // Filter plugins matching known type labels
    filteredHooks  = filterByType(lines, "lsp-manager")   // bundle.js:+11445657
    filteredPlugin = filterByType(lines, "plugin:")        // bundle.js:+11445692
    genericErrors  = filterByKind(lines, "generic-error")  // bundle.js:+11445804

    // Assemble the text block
    responseText = lines.join(" · ")

    // Return as content block with kind="text"
    return { kind: "text", content: responseText }        // bundle.js:+11446469
```

Error entries use `kind: "error"` (bundle.js:+11446394); normal entries use `kind: "text"` (bundle.js:+11446469). The separator literal `" · "` is at bundle.js:+11446339.

Analysis basis: CC v2.1.141 bundle.js:+11446339

---

### 6. LSP Server Config Reading (`TIH` / `Wl4`)

LSP plugin discovery reads `.lsp.json` files and validates paths.

```
async function readLSPConfigs(pluginDir):
    configPath = join(pluginDir, ".lsp.json")    // bundle.js:+8326375
    raw = await readFile(configPath)
    parsed = JSON.parse(raw)                     // b6  bundle.js:+8326430

    // Validate all referenced paths are relative and within plugin directory
    for entry in parsed.entries:
        relativePath = path.relative(pluginDir, path.resolve(pluginDir, entry.path))
        if relativePath.startsWith(".."):        // bundle.js:+8326274
            throw new Error("Invalid path: must be relative and within plugin directory")
                                                 // bundle.js:+8327575

    // Merge into existing config via Object.assign
    return Object.assign({}, existingConfig, parsed)  // bundle.js:+8326491
```

On parse failure, the error is labelled `"lsp-config-invalid"` (bundle.js:+8326645) and `"Failed to parse JSON file"` (bundle.js:+8327092).

Analysis basis: CC v2.1.141 bundle.js:+11444644

---

### 7. Plugin Registry State Management

The call to `registerPluginHooksAndServers` (rooted at `GLH`) resolves dependency graphs and handles multiple error codes.

```
function resolvePluginDependencies(plugin, registry):
    // Check for dependency-unsatisfied conditions
    if not satisfiesDependency(plugin):          // bundle.js:+10665360
        markAs("dependency-unsatisfied")

    // Check for not-found condition
    if not findInRegistry(plugin):               // bundle.js:+10665397
        markAs("not-found")

    // Resolve dependency graph
    for dep in plugin.dependencies:             // dI7  bundle.js:+11444836
        if dep has dependency-resolution error:  // bundle.js:+10666372
            addErrorEntry(dep)

    // Handle all-plugins-installed state
    if allInstalled(registry):                  // bundle.js:+10696407
        setState("all-plugins-installed")
    elif allProjectInstalled(registry):         // bundle.js:+10696531
        setState("all-plugins-project-installed")
```

Analysis basis: CC v2.1.141 bundle.js:+10665360

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — tengu_daemon_control | Emitted when the daemon receives the control request (bundle.js:+14499703) |
| Telemetry — tengu_daemon_config_reload | Emitted upon daemon config reload triggered by plugin changes (bundle.js:+14478760) |
| Telemetry — tengu_feature_ok | Emitted on successful feature check (bundle.js:+945566) |
| Telemetry — tengu_feature_bad | Emitted on failed feature check (bundle.js:+945624) |
| Telemetry — tengu_iron_gate_closed | Emitted if the iron-gate circuit breaker fires during plugin processing (bundle.js:+8032919) |
| Telemetry — tengu_daemon_yield | Emitted if the daemon yields to a foreground/service daemon during reload (bundle.js:+14482794) |
| Control request dispatch | Sends a `"control-request"` message to the daemon via `A.sendControlRequest` (bundle.js:+11446126) |
| Cache clearing | Clears installed-plugins cache, policy context, LSP config, and all ancillary plugin caches (bundle.js:+11444179) |
| Plugin registry update | Writes updated plugin states into the runtime registry via `GLH` (bundle.js:+11446529) |
| Event emission | Emits plugin status change event via `xj8.emit` (bundle.js:+11445241) |
| Plugin type telemetry literal | Internal event name `"reload_plugins"` used for tracking (bundle.js:+11446156); short key `"ccr"` (bundle.js:+11446107) |
| Hook registration | Re-registers hook-type plugins (literal `"hook"` at bundle.js:+11446745) |
| supportsNonInteractive | `false` — command cannot be run in non-interactive mode |
| thinClientDispatch | `"control-request"` — in thin-client deployments the command is forwarded as a control request rather than executed locally |

---

## Version History

| Version | Change |
|---|---|
| v2.1.141 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `/reload-plugins` sets `supportsNonInteractive: false`. Attempting to invoke it from a script or piped session will be rejected by the CLI before the handler is ever called.
2. **Expecting instant MCP server reconnection**: The command clears caches and re-registers plugin metadata, but MCP server processes that were already terminated may require additional time (or a separate reconnect flow) before they are fully operational.
3. **Confusing thin-client behavior**: In thin-client deployments, the command is dispatched as `"control-request"` to the daemon rather than executing the handler locally. The response latency is higher and depends on the daemon's control-request queue.
4. **Editing `.lsp.json` with absolute paths**: The LSP config reader validates that all paths are relative and within the plugin directory; absolute paths or `..` traversal patterns will be rejected with the error `"Invalid path: must be relative and within plugin directory"` (bundle.js:+8327575).
5. **Using yarn/pnpm lockfiles in npm-type plugins**: The plugin resolution layer explicitly rejects `yarn.lock` and `pnpm-lock.yaml` and requires bun or npm (bundle.js:+4798006).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `cI7` | Main handler — `reloadPluginsHandler` (AsyncFunction, arbor-resolved) |
| `V3` | Control-request pre-flight validator |
| `njH` | Control-request transport helper |
| `Ad` | Plugin registry accessor |
| `b8` | Plugin registry state container |
| `AJH` | `refreshActivePlugins` — cache clear + plugin re-discovery orchestrator |
| `v` | Generic async logger / telemetry emit helper |
| `J7K` | Log transport formatter |
| `Qt_` | Log sink dispatcher |
| `SH` | JSON-stringify wrapper |
| `t7` | Log line builder (path redaction) |
| `T6A` | Path-segment mapper |
| `MSH` | Output writer orchestrator |
| `M6A` | Raw stream writer |
| `X7K` | File-write pipeline manager |
| `bhH` | Batched output flush controller |
| `A_H` | Append-file helper |
| `x6` | Path resolution utility |
| `Cv8` | File metadata checker |
| `y6A` | Path join wrapper |
| `k6A` | File rename / rotation handler |
| `P7K` | Directory-create + append pipeline |
| `b9` | Subscriber set manager |
| `Vs1` | Installed-plugins cache clearer |
| `y3` | Misc plugin cache clearer |
| `vA7` | Plugin sub-cache orchestrator |
| `zZ` | Cache layer coordinator |
| `BO8` | Plugin object cache A |
| `Q88` | Plugin object cache B |
| `EA8` | Plugin object cache C |
| `lD_` | Plugin root filter / `pluginRoot` key resolver |
| `kH` | Plugin registry loader |
| `I88` | Plugin object cache D |
| `tk_` | Plugin object cache E |
| `Os1` | Plugin object cache F |
| `eHH` | Plugin event-type sub-cache clearer |
| `PqH` | Event cache A |
| `qs1` | Event cache B |
| `Dz8` | Event cache C |
| `dz_` | Dependency-cache clearer |
| `sz_` | Skills-cache clearer |
| `TrH` | `CO8` (plugin cache map) clear helper |
| `FS1` | LSP config cache clearer |
| `XB1` | Policy-context cache clearer |
| `e8` | Error format builder |
| `K` | Column-pad formatter |
| `Di` | Installed-plugin discoverer |
| `i0_` | `.mcp.json` config file reader |
| `$8` | Error-code classifier (ENOENT / EISDIR) |
| `b6` | `JSON.parse` wrapper |
| `Vg` | Archive-type detector (`.mcpb` / `.dxt`) |
| `kZ1` | Plugin state resolver (download / manifest / extract) |
| `i$6` | `.mcpb` archive extractor and manifest processor |
| `TH` | String coercion helper |
| `TIH` | `.lsp.json` config reader |
| `Wl4` | LSP config path validator and entry merger |
| `Xl4` | LSP path relative-check helper |
| `XTq` | Daemon status writer |
| `Ia` | Daemon status formatter |
| `p7` | AsyncLocalStorage context accessor |
| `b06` | Daemon status file path builder (`daemon.status.json`) |
| `O` | Background-session state container |
| `dI7` | Plugin status line builder / filter |
| `KWq` | Plugin display name formatter |
| `GLH` | Plugin hook and server registration orchestrator |
| `vg` | Known-marketplace registry loader |
| `k5` | `known_marketplaces.json` file reader |
| `cO8` | Marketplace config path builder |
| `q$6` | Plugin-entry object mapper |
| `I8` | Plugin instance constructor |
| `$C6` | Plugin scope validator |
| `YI` | Managed-scope error thrower |
| `BA` | Source-type parser (includes / split) |
| `XP` | Plugin installation policy checker |
| `O$6` | Host-pattern policy evaluator |
| `P68` | Policy-settings extractor |
| `_o9` | File/directory source validator |
| `Ao9` | File source handler |
| `tA4` | GitHub / git / url / npm source handler |
| `rt` | Policy-settings instance builder |
| `sA4` | Skills-dir source handler |
| `WEH` | `.claude-plugin` marketplace.json reader |
| `fX6` | Marketplace config locator |
| `_y_` | Marketplace config safe-parser |
| `M8` | Error-code extractor (`code` field) |
| `b0` | Composite plugin config reader |
| `xz_` | Plugin config file reader with fallback |
| `iJ7` | LSP server entry registry (has-check) |
| `e$6` | Full plugin-install pipeline (resolve → install → register) |
| `wI` | Plugin instance type-checker |
| `x88` | Source-type/policy cross-checker |
| `M96` | Relative-path prefix checker (`./`) |
| `N6` | User-scope context accessor |
| `bS6` | AsyncLocalStorage user-scope retriever |
| `TT` | Plugin settings file reader |
| `qy_` | Plugin settings sync reader |
| `Ky_` | Plugin settings entry iterator |
| `J` | Process-kill set manager |
| `N` | Background process lifecycle manager |
| `X` | MCP server connection manager |
| `gT8` | MCP transport factory |
| `k_` | Error/string normalizer |
| `Xm` | Source-type display formatter |
| `ph` | Plugin display helper |
| `w68` | semver validity checker (`wg.valid/coerce/satisfies`) |
| `W` | Plugin event debounce manager |
| `z` | Plugin process watchdog |
| `w$H` | Config-change event broadcaster |
| `bBH` | Skills-change detector |
| `lr9` | Dependency graph resolver |
| `M` | Active-plugin registry map |
| `m_` | Full plugin load and activation sequence |
| `Jf` | Settings file path builder |
| `Bm8` | Settings write orchestrator |
| `hD` | Settings migration helper |
| `Fu8` | Settings write timestamp recorder |
| `Xc` | Settings file accessor (resolve / exists) |
| `$CH` | Atomic file writer (temp + rename) |
| `ZY` | Cache-map bulk clear helper |
| `jR6` | Settings file append / write helper |
| `ky` | `.claude/settings.json` path builder |
| `ex` | Settings load pipeline |
| `u88` | Plugin path sandbox validator |
| `y` | Output stream writer |
| `Q` | Output queue flusher |
| `g` | Tool-call permission classifier |
| `$f8` | Permission rule evaluator |
| `nHH` | Permission decision dispatcher |
| `d` | Plugin data store (get / set) |
| `l26` | Plugin data file reader |
| `cLq` | Plugin data file deleter |
| `OH` | Hook output collector |
| `fH` | Hook output enqueue helper |
| `w` | Worker-pool process manager |
| `l` | Active-session filter |
| `r` | Voice recording session manager |
| `_$6` | semver range validator and resolver |
| `v$_` | Version object builder |
| `y88` | Git-subdir resolver |
| `D81` | Git remote-tag lister |
| `h88` | npm registry version resolver |
| `l44` | npm registry HTTP client |
| `O8` | Child-process spawn wrapper |
| `t$6` | Plugin install / unpack orchestrator |
| `HO6` | Plugin archive unpacker |
| `p88` | Plugin install state reporter |
| `V81` | Plugin version recorder |
| `c1H` | Plugin hash calculator (sha256) |
| `En` | Plugin directory entry |
| `P` | HTTP/SSE transport stream |
| `X68` | Plugin output directory scanner |
| `Ig` | Plugin install result reporter |
| `cgH` | Plugin cache-entry updater |
| `b88` | Plugin cleanup helper |
| `Cz_` | Plugin registry update helper |
| `S` | Away-summary session state tracker |
| `XF` | Focus/blur state classifier |
| `Z` | Away-summary generator |
| `Icq` | Rate-limit checker |
| `KH` | Keyboard-input queue |
| `o` | Voice recording state machine |
| `T` | Remote-control startup handler |
| `DH` | Voice session teardown helper |
| `a8` | Async abort-controller wrapper |
| `JhH` | Locale / language header builder |
| `p_` | Plugin load trigger |
| `Cn_` | Plugin basename normalizer |
| `rP8` | Voice-stream WebSocket manager |
| `NH` | Replay/state reporter |
| `VH` | Conversation context container |
| `iH` | Hook execution reporter |
| `EH` | Plugin list display renderer |
| `hH` | `tengu_feature_ok` emitter |
| `xH` | `tengu_feature_bad` emitter |
| `Y` | MCP server config hot-reload handler |
| `R` | Session output channel |
| `C` | Output write dispatcher |
| `qH` | Focus-silence timeout manager |
| `G` | MCP connection registry |
| `i44` | Plugin source union type builder |
| `iN` | Plugin type normalizer (toLowerCase) |
| `jM` | String coercion reporter |
| `RH` | String converter |
| `$L` | OTEL metrics attribute builder |
| `MV8` | OTEL attribute map initializer |
| `AgH` | OTEL resource attribute assembler |
| `GH6` | OTEL event emitter |
| `nt` | Plugin status notification formatter (final output) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.