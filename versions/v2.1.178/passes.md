---
type: feature-spec
feature: "passes"
cc_version: "2.1.178"
updated: "2026-06-16"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.178 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.178 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.178

---

## Overview

The `/passes` command surfaces a guest-pass gifting screen that allows the current Claude Code user to share a free week of Claude Code access with friends. It is a `local-jsx` command whose handler (`x_5`) renders a JSX UI element and emits a telemetry event when the screen is visited. The command does not send a prompt to the AI agent; it is entirely UI-driven.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| module_id | `XJK` |
| load_inline | `true` |
| isHidden | `null` (not hidden) |
| loc_byte | `12834030` |
| loc_byte_end | `12834352` |
| arbor_handler.name | `x_5` |
| arbor_handler.fqn | `claude-2.1.178::x_5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.178 bundle.js:+12834030

---

## Input Branching

The command follows a simple linear flow with no complex user-input branching: the handler is invoked, fires a telemetry event, resolves configuration/session state, and renders the JSX guest-pass screen. Two or fewer distinct logical paths are present, so pseudocode is used below.

```
1. User types /passes → CLI dispatches to handler x_5
2. x_5 is invoked (AsyncFunction)
3. Telemetry event "tengu_guest_passes_visited" is emitted
4. Handler resolves any needed app state (session, config, auth)
5. sJA.createElement(...) builds the JSX guest-pass UI component
6. The rendered component is returned to the CLI shell for display
```

---

## Behavioral Spec

### Main Handler — Guest Pass Screen Renderer

Handler `x_5` (resolved via `module_id → XJK`, Arbor path: `module_id`).

```
async function guestPassHandler(context):
    emit telemetry("tengu_guest_passes_visited")      // bundle.js:+12833853

    sessionData   = await resolveSessionContext()      // calls iQ8 → Z4 → Hw
    configWriter  = await resolveConfigWriter()        // calls W8 → wO8
    appDispatch   = resolveDispatch(context)           // calls d

    uiElement = createElement(GuestPassComponent, {    // bundle.js:+12833902
        session:  sessionData,
        config:   configWriter,
        dispatch: appDispatch,
    })

    return uiElement
```

Analysis basis: CC v2.1.178 bundle.js:+12833713

---

### Session Context Resolution (`iQ8` → `Z4` → `Hw`)

```
function resolveSessionContext():
    rawSession  = loadSessionModule()          // iQ8, bundle.js:+12833747
    sessionView = buildSessionView(rawSession) // Z4,  bundle.js:+12446816
    hwContext   = hydrateHwContext(sessionView)// Hw,  bundle.js:+3302953
    return hwContext
```

`Hw` fans out to UI sub-components (`Qj`, `SO`, `E4`, `rA`, `tP`, `wG6`, `eaH`) that assemble authentication profile information and screen-layout state used by the guest-pass UI.

Analysis basis: CC v2.1.178 bundle.js:+12446816

---

### Config Writer Resolution (`W8` → `wO8`)

```
function resolveConfigWriter():
    kT   = resolveConfigToken()                // W8 → kT,  bundle.js:+3345597
    cfgH = resolveConfigHandle()               // W8 → H,   bundle.js:+3345617

    writer = buildConfigWriter(kT, cfgH)       // wO8, bundle.js:+3345593
    writer uses:
        - filesystem ops: mkdirSync, statSync, copyFileSync,
                          readdirStringSync, unlinkSync
        - path helpers:   pD.dirname, pD.basename, pD.join
        - backup rotation: keeps up to 5 backup slots   // bundle.js:+3349842
        - backup file tag: ".backup."                   // bundle.js:+3349709
        - file-save guard: refuses write when re-read
          config is missing auth that cache has
          (safety fix for GH #3117)                     // bundle.js:+3349239

    return writer
```

Analysis basis: CC v2.1.178 bundle.js:+3345593

---

### Config Read Sub-System (`_MH`)

`wO8` delegates actual on-disk config reads to `_MH` (config reader). Salient behaviours:

```
function readConfig(path):
    if config accessed before allowed:
        throw Error("Config accessed before allowed.")  // bundle.js:+3350856

    raw = fs.readFileSync(path, "utf-8")               // bundle.js:+3350912, 3350939
    parsed = JSON.parse(raw)                           // via i6, bundle.js:+3350959

    if code starts with known prefix:
        strip prefix via Rm                            // bundle.js:+3350962

    on ENOENT:
        return default config object                   // bundle.js:+3351086

    on parse error:
        emit telemetry("tengu_config_parse_error")     // bundle.js:+3351487
        return default config object
```

Status string constants found in this subsystem (used for config-state classification):

| Literal | Meaning |
|---|---|
| `"unknown"` | Auth state indeterminate |
| `"local"` | Local credentials |
| `"migrated"` | Credentials migrated from prior install |
| `"native"` | Native credential store |
| `"installed"` | Package installed |
| `"disabled"` | Feature flag disabled |
| `"enabled"` | Feature flag enabled |
| `"no_permissions"` | Insufficient permissions |
| `"global"` | Global config scope |
| `"not_configured"` | Auth not yet set up |

Analysis basis: CC v2.1.178 bundle.js:+3346231 – +3346458

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_guest_passes_visited` emitted once per `/passes` invocation (bundle.js:+12833853) |
| Telemetry — config layer | `tengu_config_parse_error` (bundle.js:+3351487), `tengu_config_lock_contention` (bundle.js:+3348912), `tengu_config_stale_write` (bundle.js:+3349049), `tengu_config_auth_loss_prevented` (bundle.js:+3349391), `tengu_config_fallback_write` (bundle.js:+3348528) |
| Telemetry — background daemon layer (reachable via callGraph depth-2) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_sendclaim_failed`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick`, `tengu_bg_attach_legacy_autorespawn`, `tengu_scheduled_task_missed`, `tengu_feature_ok`, `tengu_feature_bad` |
| Filesystem side effects | Config backup rotation (up to 5 slots, `.backup.` suffix) via `wO8`; `mkdirSync`, `copyFileSync`, `unlinkSync` (bundle.js:+3349816, +3349842, +3349960) |
| JSX rendering | `sJA.createElement(...)` called to build and return the guest-pass UI component (bundle.js:+12833902) |
| Hook registration | `F9 → XSA.register` registers a watcher hook via `wnf` (bundle.js:+66308); `$O8.watchFile` / `$O8.unwatchFile` used for config file watching (bundle.js:+3347046, +3347379) |
| appState changes | None confirmed at `/passes` handler level; background daemon state machine transitions (`spawned`, `claimed`, `working`, `idle`, etc.) are reachable but belong to the daemon subsystem, not this command directly |
| Sound | None found in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.178 | Initial analysis |

---

## Common Mistakes

1. **Expecting an AI response**: `/passes` is a `local-jsx` command. It renders a UI screen locally and does not send a prompt to the Claude model. No conversational output is produced.
2. **Confusing it with a billing command**: The command shows a gifting/referral flow for sharing trial access; it does not manage the current user's own subscription or billing.
3. **Running it in a non-interactive session**: Because the command renders a JSX component, using it in a pipe or headless environment will produce no useful output. It requires a live interactive terminal.
4. **Expecting instant pass delivery**: The UI is a screen for initiating the gift; actual pass provisioning occurs through the Anthropic backend, not the CLI itself.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `x_5` | Main handler for `/passes` (AsyncFunction, Arbor-resolved via module_id XJK) |
| `S6` | Config save/lock orchestrator |
| `n6` | Config path resolver helper |
| `$k_` | Config key sanitiser / pre-processor |
| `_MH` | Config file reader (disk → parsed object) |
| `q` | Filesystem module wrapper (readFileSync, statSync, etc.) |
| `F1` | CLI error exit handler |
| `i6` | JSON parse wrapper |
| `Rm` | String prefix stripper for config tokens |
| `H` | Random/timer utility (Math.random, setTimeout) |
| `_` | General filesystem util (readdirStringSync, statSync) |
| `Z8` | Logging / debug utility |
| `WL9` | Backup directory enumerator |
| `zk_` | Backup sub-path builder (path.join + M_) |
| `M` | Session/feature-flag map accessor |
| `$` | Symbol / config value accessor |
| `N` | HTTP / API request helper |
| `AM4` | API response handler |
| `xH` | JSON stringify wrapper |
| `d4` | String/content sanitiser (REDACTED masking) |
| `VdH` | Formatting helper (FCA) |
| `LM4` | File-upload / content-send helper |
| `d` | Generic async dispatch / deferred helper |
| `D` | Background daemon session manager |
| `A` | Locale / case utility (toLowerCase) |
| `b` | Scheduled-task runner |
| `o8` | Abort / timeout wrapper |
| `bH` | Feature-flag "ok" reporter |
| `SH` | Feature-flag "bad" reporter |
| `ul8` | macOS memory helper |
| `dRH` | Roster file reader / filter |
| `RH` | Error logger (logError sink) |
| `F` | Background PTY session lifecycle manager |
| `O6` | Spare-session enabler |
| `ZhA` | Socket claim / auth handshake |
| `khA` | Daemon job lifecycle handler |
| `f` | Promise tracking set manager |
| `w` | Forced-shutdown handler |
| `dH` | Low-level stream/socket helper (c36) |
| `B` | Disposable resource manager |
| `wnf` | Config file watcher (watchFile/unwatchFile) |
| `ug` | Unknown utility reached via wnf |
| `F9` | Hook registrar (XSA.register) |
| `iQ8` | Session module loader |
| `Z4` | Session view builder (Hw orchestrator) |
| `Hw` | UI hydration context builder |
| `vL` | Bare-mode launcher helper (--bare flag) |
| `Qj` | Auth-profile UI sub-component assembler |
| `E4` | First-party auth strategy resolver |
| `tP` | Terminal profile helper |
| `SO` | Main session/screen orchestrator |
| `wG6` | Layout helper (eaH wrapper) |
| `eaH` | UI element factory (L6, d_H) |
| `W8` | Config writer top-level coordinator |
| `wO8` | Config writer implementation (disk ops) |
| `tR1` | Object-assign config merger |
| `v2_` | Config merge sub-helper (sR1) |
| `JsH` | Config journal / side-effect handler |
| `V` | Scroll/viewport math utility |
| `S` | Supervisor output stream writer |
| `E` | Viewport clamp utility (Math.max/min) |
| `P` | IPC message framer / splitter |
| `X` | Socket-timeout manager |
| `j` | Session kill coordinator |
| `lL` | Stream end + stringify helper |
| `Gb5` | Daemon IPC protocol handler (full message dispatch) |
| `TH` | String coercion helper |
| `ED6` | Atomic file writer (tmp + rename, fchmod, fsync) |
| `O` | Background-session context object |
| `x8` | Z8-based logging wrapper |
| `L` | TLS/socket close handler |
| `gXH` | Unknown config guard helper |
| `PL9` | Object.entries-based config iterator |
| `CG6` | Timestamp helper (Date.now) |
| `YO8` | Config symlink / path resolution helper |