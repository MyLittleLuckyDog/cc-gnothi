---
type: feature-spec
feature: "autofix-pr"
cc_version: 2.1.139
updated: "2026-05-18"
tags: ["autofix-pr", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.132
analysis_basis: "CC v2.1.132 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/autofix-pr`

> Analysis basis: CC v2.1.132 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.132

---

## Overview

The `/autofix-pr` command instructs Claude Code to continuously monitor the pull request associated with the current branch, detect any failing checks, linting errors, or review-blocking issues, and attempt to resolve them automatically. It operates as a local JSX-rendered slash command and is surfaced directly in the Claude Code interactive CLI. The core mechanism combines PR status polling with an agentic repair loop that applies code changes and re-pushes until all checks pass or a terminal condition is reached.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `autofix-pr` |
| description | `Monitor and autofix any issues with the current PR` |
| argumentHint | `null` (no argument expected) |
| loc\_line | 5470 |

Analysis basis: CC v2.1.132 bundle.js:+9781195

---

## Input Branching

The AST traversal at depth ≤ 2 did not resolve any entry-function edges for this command's implementation module (see `"note": "no entry functions found for module 'undefined'"`). As a result, internal branching logic cannot be stated as verified fact from the extracted data.

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

The following flowchart represents the **structurally expected** behavior for a command of this registration type (`local-jsx`) combined with its declared purpose. Every node that cannot be directly cited from the AST data is marked `[inferred]`.

```mermaid
flowchart TD
    A([User invokes /autofix-pr]) --> B{Git repo detected?}
    B -- No --> C[Display error: not inside a git repository\n[inferred]]
    B -- Yes --> D{Remote PR exists for current branch?}
    D -- No --> E[Display error: no open PR found for branch\n[inferred]]
    D -- Yes --> F[Fetch current PR status and check results\n[inferred]]
    F --> G{All checks passing?}
    G -- Yes --> H[Report: PR is already healthy — nothing to fix\n[inferred]]
    G -- No --> I[Enumerate failing checks / lint errors / review blocks\n[inferred]]
    I --> J[Enter agentic repair loop\n[inferred]]
    J --> K[Apply targeted code edits\n[inferred]]
    K --> L[Stage and commit changes\n[inferred]]
    L --> M[Push to remote branch\n[inferred]]
    M --> N{Re-check PR status}
    N -- Still failing --> O{Retry limit reached?\n[inferred]}
    O -- No --> J
    O -- Yes --> P[Report: could not fully autofix — show remaining issues\n[inferred]]
    N -- All passing --> Q[Report: PR fully fixed and passing\n[inferred]]
```

> **Note:** All nodes marked `[inferred]` are structural expectations derived from the command description and `local-jsx` type contract. They are **not** confirmed by the depth-2 AST extraction.

---

## Behavioral Spec

Because the AST traversal returned an empty `callGraph`, empty `literals`, and empty `telemetry` array, no sub-feature pseudocode can be stated as bundle-verified behavior at this time.

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

### Command Entry Point (Registration Contract)

The following pseudocode describes what is verifiably known: the command is registered as a `local-jsx` type, accepts no argument (`argumentHint` is null), and is presented to the user with its description string.

```
function registerAutofixPrCommand():
    register({
        type:        "local-jsx",
        name:        "autofix-pr",
        description: "Monitor and autofix any issues with the current PR",
        argumentHint: null
    })
```

Analysis basis: CC v2.1.132 bundle.js:+9781195

### PR Monitoring and Repair Loop (Inferred Structure)

```
// [inferred — not confirmed by depth-2 traversal]
function autofixPr(context):
    repo = detectGitRepository(context)
    if repo is absent:
        return displayError("not inside a git repository")

    pr = fetchOpenPullRequest(repo.currentBranch)
    if pr is absent:
        return displayError("no open PR found for current branch")

    issues = collectFailingChecks(pr)
    if issues is empty:
        return displaySuccess("PR is already healthy")

    attempt = 0
    while issues is not empty:
        attempt += 1
        if attempt exceeds retryLimit:
            return displayPartialFailure(issues)

        edits = generateRepairEdits(issues)
        applyEdits(edits)
        stageAndCommit(edits)
        pushToRemote(repo)
        issues = collectFailingChecks(refreshPullRequest(pr))

    return displaySuccess("PR fully fixed and all checks passing")
```

<!-- TODO: retryLimit value not found in depth-2 traversal; needs --depth 4 -->

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Git side effects | Expected: commits pushed to remote branch `[inferred]` |
| File system side effects | Expected: source files modified in working tree `[inferred]` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.132 | Initial analysis — registration confirmed at bundle.js:+9781195; implementation module unresolved at depth-2 traversal |

---

## Common Mistakes

1. **Invoking the command outside a git repository.** The command's purpose requires an active git context with a remote. Running it in a plain directory will produce an error before any PR monitoring can begin.
2. **Invoking without an open PR on the current branch.** If the current branch has no associated open pull request on the configured remote, the command has nothing to monitor. Create or push the PR first.
3. **Passing an argument.** The `argumentHint` field is `null`, indicating the command takes no inline argument. Any text typed after `/autofix-pr` may be silently ignored or cause unexpected behavior depending on the CLI argument parser.
4. **Expecting fully silent operation.** As a `local-jsx` command, the command renders output directly in the interactive CLI session. It is not designed for unattended background execution without a live terminal.
5. **Assuming idempotent commits.** Each repair iteration may produce one or more commits on the branch. Repeated invocations on a partially-fixed PR will layer additional commits rather than amending the previous repair commit.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| *(none)* | The depth-2 AST traversal returned an empty `identifiers` array for this command. No obfuscated identifiers were resolved. <!-- TODO: needs --depth 4 --> |