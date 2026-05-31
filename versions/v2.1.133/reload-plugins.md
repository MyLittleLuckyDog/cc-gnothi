---
type: feature-spec
feature: "reload-plugins"
cc_version: "2.1.133"
updated: "2026-05-31"
tags: ["reload-plugins", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.133 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/reload-plugins`

> Analysis basis: CC v2.1.133 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.133

---

## Overview

`/reload-plugins` is a local slash command that activates pending plugin changes in the current Claude Code session without requiring a full restart. It clears all plugin caches, re-reads plugin configuration from disk, re-initialises every active plugin MCP server, and emits a structured status message back to the user listing each plugin's updated state. The command dispatches over the `control-request` channel and is not available in non-interactive (headless) sessions.

---

## Registration

| Field | Value |
|---|---|
| `type` | `local` |
| `name` | `reload-plugins` |
| `description` | Activate pending plugin changes in the current session |
| `supportsNonInteractive` | `false` |
| `thinClientDispatch` | `"control-request"` |
| `module_id` | `_$q` |
| `load_inline` | `true` |
| `loc_byte` | 11274499 |
| `loc_byte_end` | 11274718 |
| `loc_line` | 7078 |
| `arbor_handler.name` | `HY7` |
| `arbor_handler.fqn` | `claude-2.1.133::HY7` |
| `arbor_handler.kind` | `AsyncFunction` |
| `arbor_handler.resolution_path` | `module_id` |
| `arbor_handler.n_hits` | 0 |

Analysis basis: CC v2.1.133 bundle.js:+11274499

---

## Input Branching

The command takes no user-supplied arguments. Its internal branching arises from the state of each plugin discovered during the reload sequence (connected, error, hook type, LSP vs. MCP). There are more than three distinct outcome paths, so a flowchart is used.

```mermaid
flowchart TD
    A([User runs /reload-plugins]) --> B[sendControlRequest via thinClientDispatch]
    B --> C[handler HY7 invoked]
    C --> D[oM: validate / guard call]
    D --> E[lDH: refreshActivePlugins]
    E --> F["Log: clearing all plugin caches\n(bundle.js:+11271646)"]
    F --> G[Bg9: clear installed-plugins cache\n(bundle.js:+9179439)]
    G --> H[_3: reset plugin-registry state]
    H --> I[Kt: reload MCP server configs\nfrom disk (.mcp.json, .mcpb, .dxt)]
    I --> J[uTH: reload LSP server configs\nfrom disk (.lsp.json)]
    J --> K[M.reduce: apply MCP updates\nper-server via Og7]
    K --> L{For each plugin server}
    L --> M1[iZH: connect / reconnect server\nover stdio / sse / sse-ide / ws-ide]
    M1 --> N{Connection outcome}
    N --> O1["connected\n(bundle.js:+9475674)"]
    N --> O2["failed\n(bundle.js:+9476241)"]
    N --> O3["disabled\n(bundle.js:+9474877)"]
    N --> O4["needs-auth\n(bundle.js:+9475572)"]
    O1 --> P[eD7: build status entry]
    O2 --> P
    O3 --> P
    O4 --> P
    P --> Q{Entry type}
    Q --> R1["plugin MCP server\n(bundle.js:+11273745)"]
    Q --> R2["plugin LSP server\n(bundle.js:+11274237)"]
    Q --> R3["hook\n(bundle.js:+11274178)"]
    R1 --> S[Append ' · ' separator\n(bundle.js:+11273772)]
    R2 --> S
    R3 --> S
    S --> T[YqH: register updated plugin tools\nand resources in session]
    T --> U[Bz8.emit: broadcast reload event\nto session subscribers]
    U --> V[Ua: format final text response]
    V --> W[Return type:'text' message\nto user (bundle.js:+11273902)]
    W --> X([Done])
```

---

## Behavioral Spec

### Top-Level Handler (`HY7`)

```
async function reloadPluginsHandler(context):
    sendControlRequest("ccr", "reload_plugins")       // bundle.js:+11273540, +11273589
    guardedValidate(context)                           // oM → RwH
    result = await refreshActivePlugins(context)       // lDH
    updatedTools = await updatePluginToolRegistry()    // YqH
    response = formatStatusText(result, updatedTools)  // Ua
    return { type: "text", content: response }         // bundle.js:+11273902
```

Analysis basis: CC v2.1.133 bundle.js:+11273522, +11273559, +11273634, +11273930, +11273962, +11274005

---

### Plugin Cache Refresh (`lDH` — `refreshActivePlugins`)

```
async function refreshActivePlugins(context):
    log("refreshActivePlugins: clearing all plugin caches")  // bundle.js:+11271646

    clearInstalledPluginsCache()    // Bg9 → k: "Cleared installed plugins cache" (+9179441)
    resetPluginRegistry()           // _3 → cc4, et, E5A, h5A, BcH
    clearJT9State()                 // JT9
    clearPendingState()             // dh9, pW

    mcpConfigs = await Promise.all([
        loadMcpServerConfigs(),     // Kt: reads .mcp.json, .mcpb, .dxt files
        loadLspServerConfigs()      // uTH: reads .lsp.json files (+8228177)
    ])

    mergedServers = mergeReduceConfigs(mcpConfigs)  // M.reduce (+11272169)
    otherServers  = mergeReduceConfigs2(...)         // $.reduce (+11272194)

    serverMap = buildServerMap(mergedServers)        // H (+11272217)
    statusEntries = buildStatusEntries(serverMap)    // eD7 (+11272292)

    reconnectAll = applyMcpUpdates(serverMap)        // M → iZH, mFq, Og7
    await xK8(reconnectAll)                          // xK8 (+11272416)
    await ws(reconnectAll)                           // ws (+11272441)

    errorEntries = filterErrors(statusEntries)       // fH (+11272460)
    textContent  = buildTextContent(statusEntries)   // vH, L.reduce (+11272517, +11272532)

    exportedValues = Object.values(serverMap)        // +11272585
    emitReloadEvent(exportedValues)                  // Bz8.emit (+11272686)

    return { statusEntries, errorEntries, textContent }
```

Analysis basis: CC v2.1.133 bundle.js:+11271644 – +11272686

---

### MCP Server Config Loader (`Kt`)

```
async function loadMcpServerConfigs():
    configs = []

    // Phase 1: read .mcp.json from project directories
    for each configFile ending in ".mcp.json":             // bundle.js:+7429621
        raw = await readFile(configFile, "utf-8")          // +7430264, +7430287
        parsed = parseJSON(raw)                            // p6 → JSON.parse
        entries = Object.entries(parsed)
        for [name, serverDef] in entries:
            configs.push(serverDef)                        // oi

    // Phase 2: resolve .mcpb / .dxt plugin bundles
    for each entry ending in ".mcpb" or ".dxt":           // eB: +4900104, +4900125
        resolved = resolvePluginBundle(entry)              // rJ9 → a56
        configs.push(resolved)

    // Phase 3: array / multi-server shape
    if Array.isArray(rawConfig):                          // +7429840
        await Promise.all(configs.map(loadSingleServer))  // +7429870

    return configs
```

Analysis basis: CC v2.1.133 bundle.js:+7429610, +7429733, +7429752, +7429840

---

### LSP Server Config Loader (`uTH`)

```
async function loadLspServerConfigs():
    filePath = path.join(configDir, ".lsp.json")      // bundle.js:+8228177, +8228193
    raw = await readFile(filePath)
    parsed = parseJSON(raw)                            // p6

    validateRecord(parsed)                             // N.record (+8228256)
    validateStringValues(parsed)                       // N.string (+8228265)

    for [key, serverEntry] in Object.entries(parsed):
        pathSafe = assertPathSafe(serverEntry.path)    // pR4: must be relative,
                                                       // must not start with ".."
                                                       // (+8228079, "Invalid path: must be
                                                       // relative and within plugin directory")
        if not pathSafe:
            warn("lsp-config-invalid")                // +8228455
            push error entry
            continue
        assign(serverEntry, { resolved: true })        // Object.assign (+8228309)
        entries.push(serverEntry)

    return entries

    // Error path: "Failed to parse JSON file" (+8228891)
```

Analysis basis: CC v2.1.133 bundle.js:+8228177 – +8228981

---

### MCP Update Application (`Og7`)

```
async function applyMcpUpdates(serverMap):
    entries = Object.entries(serverMap)
    filtered = entries.filter(isActive)               // _.filter (+13871314)

    for each [name, serverDef] in filtered:
        clients = serverDef.getClients()              // A.getClients (+13871337)
        relevantClients = filterRelevant(clients)     // T98 (+13871393)

        if allRemoteRecovered(relevantClients):
            log("[MCP] Retry: all remote servers recovered, stopping")
            // bundle.js:+13871486
            stopRetrying()

        timeout = makeTimeout()                       // r8 (+13871451)

        updatedState = await reconnectServer(         // iZH (+13871684)
            name, serverDef, timeout
        )
        updatedState = await applyToolUpdate(         // mFq (+13871693)
            name, updatedState
        )
        resultMap[name] = updatedState

    return Object.fromEntries(resultMap)              // +13871702
```

Analysis basis: CC v2.1.133 bundle.js:+13871290 – +13871828

---

### Server Reconnect Logic (`iZH`)

```
async function reconnectServer(name, serverDef, timeout):
    if serverDef.status == "disabled":               // bundle.js:+9474877
        return { status: "disabled" }

    transport = serverDef.transport                  // stdio / sse / sse-ide / ws-ide / sdk
    // transport type strings: +9474979, +9475013, +9475078, +9475114

    if transport == "claudeai-proxy":                // +9475386
        handleProxyTransport()

    if cachedNeedsAuth(name):                        // +9475506
        log("Skipping connection (cached needs-auth)")
        return { status: "needs-auth" }              // +9475572

    connectionResult = await Promise.race([
        connectTransport(serverDef),                 // gZA
        raceTimeout(timeout)
    ])

    if connectionResult.ok:
        persistConnectionState()                     // Yl9
        return { status: "connected" }               // +9475674

    retryCount = parseRetryCount()                   // _J6 → parseInt
    backoff = parseBackoff()                         // fIA → parseInt
    // backoff constants: 10 (+9471827), 3 (+9471844), 20 (+9471949)

    log error via mcpErrorLogger()                   // T7 → yQ.logMCPError
    return { status: "failed" }                      // +9476241
```

Analysis basis: CC v2.1.133 bundle.js:+9474779 – +9476463

---

### Plugin Tool Registry Update (`YqH`)

```
async function updatePluginToolRegistry(context):
    existing = toolRegistry.get(context.sessionId)   // A.get (+10521208)
    toolRegistry.set(context.sessionId, pending)     // A.set (+10521244)
    pendingSet.add(context.sessionId)                // $.add (+10521266)

    marketplaceData = loadMarketplaceKnown()         // AF → Af: reads "known_marketplaces.json"
                                                     // bundle.js:+9152583

    toolEntries = mL7.map(buildToolEntry)            // +10521377

    for [toolId, toolDef] in Object.entries(toolEntries):
        toolDef = normaliseToolDef(toolDef)          // i76 → h8, j5_, zcA
        if Array.isArray(toolDef.inputs):            // +4418259
            validateInputs(toolDef.inputs)

    // Dependency resolution
    dependencyErrors = resolveDependencies(toolEntries)  // _f6
    // error codes surfaced: "dependency-unsatisfied" (+10521144),
    //                       "not-found" (+10521181),
    //                       "dependency-resolution" (+10522156)

    // Version range checking
    rangeErrors = checkVersionRanges(toolEntries)    // pL7: q.has (+10522902)

    registeredTools  = collectValid(toolEntries)     // L.push (+10522248)
    registeredErrors = collectErrors()               // L.includes (+10522234)

    return { registeredTools, registeredErrors }
```

Analysis basis: CC v2.1.133 bundle.js:+10521208 – +10522437

---

### Status Text Formatter (`Ua`)

```
function formatStatusText(statusEntries, toolResult):
    lines = statusEntries.slice(0, 5)               // q.slice (+4419394); max 5 entries shown
    parts = lines.map(entry =>
        T1(entry.name)                              // normalise name
        + entry.kind                                // "plugin MCP server" / "plugin LSP server"
                                                    // / "hook" (+11273745, +11274237, +11274178)
        + " · "                                     // separator (+11273772)
        + entry.status
    )
    return parts.join(separator)                    // q.join (+4419378)
```

Analysis basis: CC v2.1.133 bundle.js:+11274005, +4419341 – +4419446

---

### Plugin Bundle Resolver (`a56` — `.mcpb` / `.dxt` handler)

```
async function resolvePluginBundle(bundlePath):
    mkdir(targetDir, { recursive: true })           // f.mkdir (+4905928)
    raw = await readFile(bundlePath)                // f.readFile (+4906152)

    if error.code == "ENOENT":                      // +134316
        return { status: "not-found" }

    manifest = parseManifestFromBundle(raw)         // reads "manifest.json" (+4906121)
    if not manifest:
        throw Error("No manifest.json found in MCPB file")  // +4907370

    if manifest.status == "needs-config":           // +4906464
        return { status: "needs-config" }

    hash = crypto.createHash("md5")                 // us6.createHash (+4906937)
                  .update(raw)
                  .digest("hex")                    // +4906952, +4906976

    log("Extracting MCPB archive...")               // +4907259
    extract(raw, targetDir)

    log("Generating MCP server configuration...")   // +4908104
    serverConfig = generateConfig(manifest)

    return serverConfig
```

Analysis basis: CC v2.1.133 bundle.js:+4905908 – +4907913

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | No `tengu_*` events fire directly from the `/reload-plugins` handler itself within the depth-2 traversal. Events reachable transitively include `tengu_mcp_retry_failed_remote` (bundle.js:+13870729) via `Og7`; `tengu_iron_gate_closed` (bundle.js:+7940935) via `WL8`; `tengu_daemon_yield` (bundle.js:+14174626); and several `tengu_bg_*` / `tengu_daemon_*` events fired by the background process manager reachable via `w`, `Y`, and `S`. |
| Control-request channel | `thinClientDispatch: "control-request"` — the command is routed over the IPC control channel, not over the agent prompt channel. String literal `"ccr"` is the channel identifier (bundle.js:+11273540). String literal `"reload_plugins"` is the action identifier (bundle.js:+11273589). |
| Plugin cache cleared | All installed-plugin caches cleared via `Bg9` → `k`; log message "Cleared installed plugins cache" (bundle.js:+9179441). The broader log message "refreshActivePlugins: clearing all plugin caches" is emitted at entry (bundle.js:+11271646). |
| Plugin registry reset | `_3` → `cc4` clears and rebuilds the plugin registry, including `BcH` which calls `c58.clear()` (bundle.js:+9125551). |
| MCP server connections | Each active MCP server is stopped and reconnected by `iZH` / `mFq`. Transports: `stdio`, `sse`, `sse-ide`, `ws-ide`, `sdk`, `claudeai-proxy`. |
| LSP server connections | `uTH` reads `.lsp.json` (bundle.js:+8228193); path traversal prevention enforced (`".."` check, bundle.js:+8228092). |
| Plugin tool registry | `YqH` rebuilds the session's registered tool and resource map, using `A.get` / `A.set` keyed by session ID. |
| Event emission | `Bz8.emit` broadcasts the reload completion event to all in-process subscribers (bundle.js:+11272686). |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | Plugin and tool registry state is mutated in-place; settings caches (`JG6`, `Q28`) may be cleared via `l2` (bundle.js:+24901, +24913) during the registry reset. |
| Non-interactive mode | `supportsNonInteractive: false` — the command is silently unavailable in headless/scripted invocations. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.133 | Initial analysis — command registered at bundle.js:+11274499; handler `HY7` resolved via `module_id` path. |

---

## Common Mistakes

1. **Running in non-interactive mode**: Because `supportsNonInteractive` is `false`, invoking `/reload-plugins` inside a script or `--print` session will silently have no effect. Use an interactive terminal session.
2. **Expecting immediate tool availability**: The command is asynchronous; MCP servers that require OAuth (`needs-auth`) or are slow to start will not appear as connected until their handshake completes. A subsequent `/mcp` status check is recommended.
3. **Assuming all caches are preserved**: `/reload-plugins` performs a full cache clear, including the installed-plugins cache and the plugin-registry state. Any in-flight plugin resolution will be discarded and must be restarted.
4. **Using with yarn/pnpm lock files**: Plugin bundles whose source directories contain `yarn.lock` or `pnpm-lock.yaml` files will be skipped with the message "Skipped: yarn/pnpm lockfiles are not supported…" (bundle.js:+4427885). Use `bun` or `npm` lock files instead.
5. **Path traversal in `.lsp.json`**: LSP server entries with paths that resolve outside the plugin directory (i.e., containing `".."`) are rejected with `"lsp-config-invalid"` (bundle.js:+8228455) and will not be loaded.
6. **Confusing `/reload-plugins` with a full restart**: The command reconnects existing plugin MCP/LSP servers and rebuilds tool registries but does not restart the Claude Code process itself. Changes to core configuration outside of plugin scope require a full restart.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `HY7` | Main async handler for `/reload-plugins` (Arbor-resolved entry point) |
| `oM` | Guard / pre-condition validator called at handler entry |
| `RwH` | Inner validation helper called by `oM` |
| `lDH` | `refreshActivePlugins` — orchestrates full cache-clear and server reconnect |
| `Ig` | Intermediate helper called by `HY7` after control request |
| `d8` | Helper called by `Ig` |
| `k` | Low-level MCP/plugin utility (used throughout reload pipeline) |
| `Ztq` | Plugin cache clearing helper |
| `xcA` | Sub-helper of `Ztq` |
| `SH` | JSON-stringify utility |
| `Uf` | String path manipulation helper |
| `rnA` | Path mapping helper |
| `LkH` | Write helper |
| `UnA` | Buffer write helper |
| `vtq` | Plugin log / write helper (uses `uNH`, `aHH`, `Vtq`) |
| `uNH` | Debounced flush helper |
| `aHH` | Append/join log helper |
| `F6` | Filesystem utility (used in many contexts) |
| `dG8` | Error-type helper → `w8` |
| `_iA` | Path join helper |
| `AiA` | File stat / rename / unlink helper |
| `Vtq` | File append/flush cycle helper |
| `y1` | Queued-operation helper |
| `Bg9` | Clears installed-plugins cache |
| `_3` | Resets plugin-registry state; calls `cc4`, `et`, `E5A`, `h5A`, `BcH` |
| `cc4` | Plugin-registry rebuild coordinator |
| `aE` | Registry sub-initialiser |
| `a58` | Registry helper (role unclear at depth 2) |
| `es6` | Registry helper |
| `me6` | Registry helper |
| `ZMA` | Marketplace/plugin-root mapping helper |
| `fH` | Error-logging / error-classification helper |
| `ms6` | Registry helper |
| `PTA` | Registry helper |
| `Ng9` | Registry helper |
| `et` | Registry reset sub-step |
| `f1H` | Helper called by `et` |
| `Eg9` | Helper called by `et` |
| `Zf8` | Helper called by `et` and `W` |
| `E5A` | Calls `es6` during registry reset |
| `h5A` | Registry reset helper |
| `BcH` | Calls `c58.clear()` — clears a plugin registry cache set |
| `JT9` | State-clear helper |
| `dh9` | State-clear helper |
| `LA` | Utility helper used in multiple contexts |
| `L` | General list/map utility |
| `Kt` | Loads MCP server configs from disk (`.mcp.json`, `.mcpb`, `.dxt`) |
| `JJA` | Reads and parses individual `.mcp.json` files |
| `D8` | Error-code comparison helper (`ENOENT`, `EISDIR`) |
| `p6` | JSON parse wrapper |
| `eB` | File extension check (`.mcpb`, `.dxt`) |
| `rJ9` | Plugin-bundle resolver dispatcher |
| `a56` | `.mcpb` / `.dxt` bundle extraction and config generation |
| `vH` | String coercion helper |
| `uTH` | Loads LSP server configs from `.lsp.json` |
| `HA` | Error message helper |
| `UR4` | LSP config entry validator and path-safety enforcer |
| `pR4` | Path safety check (relative-path, no `..`) |
| `M` | MCP update reduce/apply coordinator |
| `iZH` | Per-server reconnect orchestrator |
| `zt` | Server connection builder |
| `$I` | Connection state helper |
| `AA` | Connection utility |
| `AJ6` | Connection filtering helper |
| `so4` | Timestamp / connection-state helper |
| `G98` | Server state inspector |
| `K8` | MCP debug logger |
| `gZA` | OAuth / transport connect helper (handles `authenticate`, `complete_authentication`) |
| `QZA` | OAuth callback URL handler |
| `Yl9` | Persists connection state to disk |
| `BZA` | Server state transition helper |
| `kJA` | Inclusion check helper |
| `J` | Process/worker kill utility |
| `S` | Stream enqueue utility |
| `T7` | MCP error logger → `yQ.logMCPError` |
| `$l9` | Connection-state helper |
| `_J6` | Retry count parser (`parseInt`) |
| `fIA` | Backoff parser (`parseInt`) |
| `mFq` | Applies tool/resource update after reconnect (`applyMcpUpdate`) |
| `XM8` | Update serialiser |
| `hI` | Server cleanup helper |
| `$` | Per-server state map helper |
| `XDq` | Timestamp/state snapshot helper |
| `J6` | Session/worker dispatch helper |
| `Bq6` | Worker helper |
| `gq6` | Worker helper |
| `Po` | Process-spawn helper |
| `_d6` | Dedup / in-flight request tracker |
| `R6` | Request timeout helper |
| `Og7` | Applies MCP updates to all active servers |
| `T98` | Remote-server recovery checker |
| `r8` | Timeout promise factory |
| `DlH` | Debug log emitter |
| `eD7` | Builds per-plugin status entries for the response |
| `A$q` | Status entry formatter helper |
| `YqH` | Rebuilds plugin tool/resource registry for the session |
| `AF` | Loads marketplace data → `Af` |
| `Af` | Reads `known_marketplaces.json` |
| `Af8` | Constructs marketplace file path |
| `i76` | Iterates tool definitions |
| `h8` | Tool definition normaliser |
| `OcA` | Tool-cache lookup (`JG6.get/has`) |
| `j5_` | Tool registration helper |
| `zcA` | Tool-cache setter (`JG6.set`) |
| `YR` | Error thrower |
| `T1` | Tool name normaliser (includes/split) |
| `gj` | Dependency injection helper |
| `a76` | Dependency resolution per tool |
| `HKA` | Dependency helper |
| `mp1` | Dependency-missing error emitter |
| `pp1` | Dependency-blocked error emitter |
| `$QK` | Dependency resolution inner helper |
| `v_H` | Tool definition lookup |
| `MQK` | Dependency cycle detector |
| `m0H` | Reads per-plugin `.claude-plugin/marketplace.json` |
| `Yw6` | Marketplace JSON parser |
| `ETA` | Schema safe-parse helper |
| `w8` | Warning/error level constant helper |
| `zG` | Reads plugin config from multiple file sources |
| `D5A` | Per-file plugin config reader |
| `pL7` | Version range set membership check |
| `_f6` | Plugin dependency graph resolver and installer |
| `Ev` | Tool existence checker |
| `ns6` | Name normalisation + `gj` integration |
| `j66` | `"./"` prefix checker |
| `O` | Settings scope map |
| `N6` | Async local storage context getter |
| `zN6` | Store getter |
| `DG` | Plugin settings reader (reads `settings.json` / `settings.local.json`) |
| `ZTA` | Settings file reader (sync) |
| `ITA` | Settings merge helper |
| `P` | Dynamic MCP connection map |
| `jP8` | Connection write helper |
| `_u` | Tool name splitter helper |
| `oo6` | Semver validation helper |
| `W` | Skills / config-change debouncer |
| `z` | Debounce state store |
| `rfH` | Config-change broadcaster |
| `_mH` | Checks for pending config changes |
| `yp1` | Plugin dependency tracker (cross-marketplace, cycle detection) |
| `xA` | Plugin installer / file-layout helper |
| `ZO` | Settings file locator |
| `OE` | Permissions helper |
| `rh8` | Install-timestamp recorder |
| `C6H` | Settings path resolver |
| `KhH` | Atomic file writer (lock + fsync) |
| `l2` | Clears `JG6` and `Q28` caches |
| `iN6` | Audit-log writer |
| `Qb` | `.claude/settings.json` path builder |
| `db` | Post-install settings persistence |
| `is6` | Path escape validator |
| `g` | Permission-gate map |
| `WL8` | Iron-gate enforcer |
| `nt` | Permission classifier |
| `Q` | Persistent storage helper (read/unlink) |
| `aJ6` | Read from persistent storage file |
| `Ce9` | Delete from persistent storage file |
| `$H` | Stream / enqueue helper |
| `ti9` | Model/stream helper |
| `wS` | Session-context helper |
| `p` | Timed write helper |
| `v6` | Value utility |
| `c` | Filtered collection helper |
| `r` | Worker/process map |
| `l76` | Version range builder |
| `oLA` | Range analysis helper |
| `Fs6` | Git-subdir plugin helper |
| `Ki1` | Git helper |
| `gs6` | npm/git version resolver |
| `BsK` | npm registry helper |
| `Y8` | Process execution helper |
| `w` | Background worker / daemon manager |
| `Af6` | Plugin archive extractor and installer |
| `qf6` | Plugin file extractor |
| `os6` | Plugin server introspector |
| `ji1` | Install helper |
| `m_H` | Path-hash calculator |
| `hc` | Workspace path helper |
| `X` | Plugin source checker |
| `so6` | Directory scanner (finds `package.json`) |
| `HF` | Process helper |
| `GUH` | Workspace path validator |
| `ls6` | Cleanup helper (rm) |
| `$5A` | Plugin-list update helper ("Updated"/"Added") |
| `y` | Clipboard / paste helper |
| `WrH` | Image paste helper |
| `GrH` | Image paste variant |
| `Y` | Background session / worker lifecycle manager |
| `HH` | MCP elicitation handler |
| `AH` | Elicitation ID tracker |
| `d` | Low-level write primitive |
| `cw6` | Elicitation request helper |
| `WQq` | Elicitation title/description provider |
| `lw6` | Elicitation response handler |
| `SF` | Notification emitter |
| `s` | Voice-session timeout handler |
| `C` | Stream write helper |
| `R` | Output stream writer |
| `qH` | Voice toggle timeout handler |
| `o` | Conversation loader / session restorer |
| `gsK` | Plugin graph scanner |
| `u` | Worker pool utility |
| `DR` | Scope checker (managed/user) |
| `W$` | Process key helper |
| `kH` | String coercion (→ String) |
| `I4` | OTEL metrics emitter |
| `bW8` | Metrics initialiser |
| `jpH` | OTEL attribute builder |
| `haH` | Event attribute helper |
| `Ua` | Final response text formatter |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.