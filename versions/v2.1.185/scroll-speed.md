---
type: feature-spec
feature: "scroll-speed"
cc_version: 2.1.185
updated: "2026-06-19"
tags: ["scroll-speed", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.181
analysis_basis: "CC v2.1.181 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/scroll-speed`

> Analysis basis: CC v2.1.181 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.181

---

## Overview

`/scroll-speed` is a local JSX command that adjusts the mouse wheel scroll speed within the Claude Code terminal UI. It operates by detecting the host editor environment (VS Code, Cursor, Windsurf, or Devin Desktop) and reading that editor's `settings.json` file to surface or apply scroll-speed configuration. The command renders a JSX component as its output rather than emitting plain text.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `scroll-speed` |
| description | Adjust mouse wheel scroll speed |
| loc_byte | `12489639` |
| loc_byte_end | `12489887` |
| loc_line | `8061` |
| module_id | `zyl` |
| load_inline | `true` |
| arbor_handler.name | `Ytf` |
| arbor_handler.fqn | `claude-2.1.181::Ytf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.181 bundle.js:+12489639

---

## Input Branching

The handler branches across 4+ distinct paths (editor environment detection → settings read → result rendering), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/scroll-speed invoked"] --> B["readEditorSettings (QBr)\nwith 250 ms timeout"]

    B --> C{"Detect host editor\nvia home-dir path fragments"}
    C -->|".vscode-server" found| D["Editor = VSCode"]
    C -->|".cursor-server" found| E["Editor = Cursor"]
    C -->|".windsurf-server" found| F["Editor = Windsurf / Devin Desktop"]
    C -->|".devin-server" found| G["Editor = Devin Desktop"]
    C -->|No match| H["Editor = unknown / unsupported"]

    D & E & F & G --> I["Locate settings.json\nvia path.join(editorConfigDir, 'settings.json')"]
    I --> J["fs.readFile(path, 'utf-8')"]

    J -->|Success| K["Parse / process settings content\n(dSn → kSt pipeline)"]
    J -->|ENOENT / EACCES / EPERM\n/ ENOTDIR / ELOOP\n/ ENAMETOOLONG / EROFS| L["File error handling (ke/Ho):\nlog error, surface friendly message"]
    J -->|Timeout (>250 ms)| M["Race resolves with\n'VS Code settings read timed out'"]

    K --> N["Format & render JSX element\n(qbo.createElement)"]
    L --> N
    M --> N
    H --> N

    N --> O["Return JSX to CLI renderer"]
```

Analysis basis: CC v2.1.181 bundle.js:+12489402, +12489411, +12489415, +12489473

---

## Behavioral Spec

### 1. Top-Level Handler (`Ytf` — `handleScrollSpeedCommand`)

The async handler is the Arbor-resolved entry point for the command (module `zyl`, resolution path: `module_id`).

```
async function handleScrollSpeedCommand(context):
    settingsResult = await Promise.race([
        readEditorSettings(context),
        withTimeout(250, "VS Code settings read timed out")
    ])
    jsxOutput = renderScrollSpeedComponent(settingsResult)
    return jsxOutput
```

- The timeout races the settings-read against a 250 ms deadline.  
  Analysis basis: CC v2.1.181 bundle.js:+12489411
- The timeout sentinel string is `"VS Code settings read timed out"`.  
  Analysis basis: CC v2.1.181 bundle.js:+12489415
- Output is produced via `qbo.createElement` (JSX factory call).  
  Analysis basis: CC v2.1.181 bundle.js:+12489473

---

### 2. Timeout Helper (`lu` — `withTimeout`)

```
function withTimeout(ms, message):
    return new Promise((resolve, reject) =>
        id = setTimeout(() => resolve({ timedOut: true, message }), ms)
    )
    // clearTimeout(id) called upon Promise.race resolution
```

- Uses `setTimeout` / `clearTimeout` / `Promise.race` to implement a non-throwing timeout.  
  Analysis basis: CC v2.1.181 bundle.js:+2335370, +2335401, +2335448
- Timeout value: **250 ms** (numeric literal `250`).  
  Analysis basis: CC v2.1.181 bundle.js:+12489411
- Timeout resolves (does not reject) so the race always produces a usable value.

---

### 3. Editor Settings Reader (`QBr` — `readEditorSettings`)

```
async function readEditorSettings(context):
    editorKind = detectEditorEnvironment()   // calls cSn (detectEditorByHomePath)
    configPath = path.join(editorConfigDir(editorKind), "settings.json")
    raw        = await fs.readFile(configPath, "utf-8")
    parsed     = parseSettingsContent(raw)   // calls dSn
    result     = buildSettingsResult(parsed) // calls kSt
    return formatForDisplay(result)          // calls JBr, ls, ke
```

Analysis basis: CC v2.1.181 bundle.js:+4133802, +4133849, +4133861, +4133875, +4133921, +4133930

- File encoding is always `"utf-8"`.  
  Analysis basis: CC v2.1.181 bundle.js:+4133909
- Settings filename is always `"settings.json"`.  
  Analysis basis: CC v2.1.181 bundle.js:+4133882

---

### 4. Editor Environment Detection (`cSn` — `detectEditorByHomePath`)

```
function detectEditorByHomePath(homePath):
    if homePath.includes(".vscode-server"):
        return { id: "vscode",   label: "VSCode" }
    if homePath.includes(".cursor-server"):
        return { id: "cursor",   label: "Cursor" }
    if homePath.includes(".windsurf-server"):
        return { id: "windsurf", label: "Windsurf" / "Devin Desktop" }
    if homePath.includes(".devin-server"):
        return { id: "devin",    label: "Devin Desktop" }
    return null   // unsupported / local environment
```

Detection fragments (all checked via `String.prototype.includes`):

| Fragment | Mapped editor label |
|---|---|
| `.vscode-server` | `VSCode` |
| `.cursor-server` | `Cursor` |
| `.windsurf-server` | `Windsurf` → `Devin Desktop` |
| `.devin-server` | `Devin Desktop` |

Analysis basis: CC v2.1.181 bundle.js:+4129675, +4129686, +4129716, +4129746, +4129778, +4129796  
Analysis basis: CC v2.1.181 bundle.js:+4134138, +4134153, +4134166, +4134181, +4134194, +4134211

---

### 5. Settings Content Builder (`kSt` — `buildSettingsResult`)

```
function buildSettingsResult(parsed):
    normalized = normalizeSettingsKeys(parsed)   // calls x9 (stripPrefix)
    structured = convertToStructuredEntry(normalized) // calls I (buildEntry)
    return String(structured)
```

- `x9` (`stripPrefix`) checks `startsWith` and uses `slice` to normalize key names.  
  Analysis basis: CC v2.1.181 bundle.js:+1183482, +1183505
- The result is coerced to `String` before return.  
  Analysis basis: CC v2.1.181 bundle.js:+1184068
- On internal error, logs at level `"error"`.  
  Analysis basis: CC v2.1.181 bundle.js:+1184087

---

### 6. Entry Builder (`I` — `buildEntry`)

```
function buildEntry(key, value):
    if key.includes("debug"):
        value = "[REDACTED]"          // sanitizes debug-level values
    normalizedKey = key.toUpperCase()
    path          = resolveKeyPath(normalizedKey)    // calls qc
    entry         = buildStructuredObject(path, value)
    entry         = applyTransforms(entry)           // calls wO, nqe, Rhc
    return entry
```

- Debug-tagged keys are redacted before any further processing (sentinel `"[REDACTED]"`).  
  Analysis basis: CC v2.1.181 bundle.js:+212635, +203988
- Key is upper-cased via `toUpperCase` before path resolution.  
  Analysis basis: CC v2.1.181 bundle.js:+212761

---

### 7. File Error Handling (`ke` — `handleFileError`)

```
function handleFileError(err):
    code = err.code
    switch code:
        case "ENOENT", "EACCES", "EPERM",
             "ENOTDIR", "ELOOP", "ENAMETOOLONG", "EROFS":
            logError(err)        // jJ.logError
            pushError(errorQueue, err)  // QVe.push
            return friendlyMessage(code)
        default:
            throw err
```

Handled filesystem error codes: `ENOENT`, `EACCES`, `EPERM`, `ENOTDIR`, `ELOOP`, `ENAMETOOLONG`, `EROFS`.  
Analysis basis: CC v2.1.181 bundle.js:+181628, +181642, +181656, +181669, +181684, +181697, +181717

---

### 8. File Write Helper (`Rhc` — `writeSettingsFile`) — reached from `buildEntry`

```
async function writeSettingsFile(filePath, content):
    dir        = path.dirname(filePath)
    byteLength = Buffer.byteLength(content)
    // size guard: max 1000 bytes soft / 100 bytes hard
    // (literals 1000 and 100 observed)
    await ensureDir(dir)
    await atomicWrite(filePath, content)
```

- Size constants observed: **1000** and **100** (bytes).  
  Analysis basis: CC v2.1.181 bundle.js:+212466, +212485
- Uses `Buffer.byteLength` for accurate UTF-8 measurement.  
  Analysis basis: CC v2.1.181 bundle.js:+212355

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal (`telemetry: []`) |
| File I/O | Reads `settings.json` from the detected editor's config directory (utf-8) |
| Timeout | 250 ms race via `Promise.race` + `setTimeout`; `clearTimeout` called on resolution |
| Error queue | File errors are pushed to an internal error queue (`QVe.push`) and logged via `jJ.logError` |
| JSX render | Output is a JSX element created with `qbo.createElement`; no plain-text stdout |
| Telemetry mode awareness | Literals `"essential-traffic"`, `"no-telemetry"`, `"default"` present in reachable code, suggesting the command respects global telemetry mode settings (via `ke` → `ta` chain) |
| Debug value redaction | Settings keys containing `"debug"` have their values replaced with `"[REDACTED]"` before display |

---

## Version History

| Version | Change |
|---|---|
| v2.1.181 | Initial analysis |

---

## Common Mistakes

1. **Expecting plain-text output**: `/scroll-speed` is a `local-jsx` command; its result is rendered as a JSX component, not printed as raw text. Scripting tools that capture stdout will not receive the scroll-speed value directly.
2. **Running in unsupported environments**: The command only detects VS Code, Cursor, Windsurf, and Devin Desktop by inspecting home-directory path fragments. Running it in a plain terminal without one of those server markers will yield no editor match and likely a null/fallback result.
3. **Assuming instant response**: The command imposes a 250 ms timeout on reading `settings.json`. On slow or remote filesystems this timeout may fire, returning the sentinel string `"VS Code settings read timed out"` instead of actual settings data.
4. **Expecting write capability**: The call graph includes a file-write helper (`Rhc`), but this is reached transitively through the entry-building pipeline, not as a direct user-facing write action. Do not assume `/scroll-speed` can persist new scroll-speed values without further investigation.
5. **Misreading the Windsurf / Devin Desktop mapping**: The `.windsurf-server` path fragment maps to both "Windsurf" and "Devin Desktop" labels in different branches; the disambiguation between those two products may depend on a secondary check.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Ytf` | Top-level async command handler (`handleScrollSpeedCommand`) |
| `lu` | Timeout-with-race helper (`withTimeout`) |
| `QBr` | Editor settings reader (`readEditorSettings`) |
| `Hdd` | Editor config directory resolver (called from `readEditorSettings`) |
| `cSn` | Editor environment detector by home-path fragments (`detectEditorByHomePath`) |
| `kSt` | Settings result builder (`buildSettingsResult`) |
| `x9` | Key prefix stripper (`stripPrefix`) |
| `I` | Structured entry builder (`buildEntry`) |
| `xhc` | Entry transform sub-step (called from `buildEntry`) |
| `Re` | JSON serializer helper (`JSON.stringify` wrapper) |
| `qc` | Key path resolver (`resolveKeyPath`) |
| `nqe` | Additional entry transform (`applyTransform1`) |
| `Rhc` | Settings file writer (`writeSettingsFile`) |
| `JBr` | Array type guard (`Array.isArray` wrapper) |
| `ls` | Utility / logging helper (wraps `ln`) |
| `ln` | Low-level log emitter |
| `ke` | File error handler (`handleFileError`) |
| `Ho` | Error constructor wrapper |
| `rt` | String coercion utility |
| `ta` | Telemetry mode resolver |
| `qYo` | Telemetry mode sub-resolver (calls `rt`) |
| `fVc` | Queue rotation helper (`ren.shift` / `ren.push`) |
| `dSn` | Settings content parser (called from `readEditorSettings`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.