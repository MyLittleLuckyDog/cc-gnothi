# cc-gnothi

> γνῶθι σεαυτόν — Know thyself.

**Claude Code CLI self-knowledge system.** An MCP-based documentation repository that enables Claude Code to fully understand and explain its own features — from slash commands to internal loop mechanics — at code-verified behavioral spec level.

## What this is

Claude Code's behavior lives in a compiled JS bundle. This project reverse-engineers that bundle (per-version) and turns it into structured, MCP-queryable knowledge:

- Every slash command documented with verified pseudocode, Mermaid flows, constants, and `bundle.js:{line}` citations
- Version-aware: each `versions/v{X.X.X}/` directory is independent
- Automatically updated when a new CC version is detected
- Delivered to CC via MCP server (Rust, in progress) as token-safe JSON chunks

When CC asks "how does `/goal` work?", the MCP server returns the exact behavioral spec — not approximations from official docs.

## Repository structure

```
cc-gnothi/
├── docs/                    Human-curated. Automation: read-only.
│   ├── chapters/            Version-independent concepts and patterns
│   ├── reference/           CLI flags and env vars (stable)
│   ├── anthropic-docs/      Official doc summaries (stale_risk: high)
│   └── cc-gnothi-docs/      Design blueprint and writing guide
│
├── versions/                Automation output. One dir per CC version.
│   └── v{X.X.X}/
│       ├── _index.md        Version meta + command list + chapter proposals
│       └── {feature}.md     Verified behavioral spec per feature
│
├── scripts/                 Automation pipeline
│   ├── analyze-new-version.js   Detects new artifacts → writes version stubs
│   └── sync-and-analyze.sh     git pull caludeCodeAVX2 → runs analyzer
│
└── src/                     cc-gnothi-mcp Rust source (planned)
```

## Document types

| Type | Path | Author | Version-bound | Role |
|---|---|---|---|---|
| `chapter` | `docs/chapters/` | human | no | Version-independent concepts |
| `feature-spec` | `versions/v{X}/{feature}.md` | automation | yes | Verified behavioral spec |
| `reference` | `docs/reference/` | human | stable | CLI flags, env vars |

## Truth hierarchy

```
1st  versions/v{X.X.X}/*.md   Direct bundle analysis. Verified facts. Latest wins.
2nd  docs/chapters/            Version-independent concepts. Human-curated.
3rd  docs/anthropic-docs/      Official doc summaries. Not guaranteed current.
```

## How the automation works

```
caludeCodeAVX2 (private) — AVX2-patched CC build for Ivy Bridge CPUs
  artifacts/claude-{X.X.X}.js    ← source of truth (Bun bundle)
       ↓
  sync-and-analyze.sh             git pull → detect new versions
       ↓
  analyze-new-version.js          extract metadata + command registrations
       ↓
  versions/v{X}/_index.md         version meta + command diff
  versions/v{X}/{feature}.md      behavioral spec (stub → claude -p analysis)
       ↓
  cc-gnothi-mcp (Rust, planned)   MD → ## section chunks → JSON
       ↓
  Claude Code                     queries MCP, gets token-safe spec
```

## Versioning strategy

- **First version (v2.1.132)**: deep analysis of all features → full feature-spec set
- **Each subsequent version**: diff registrations + implementation hashes vs previous
  - Unchanged: carry forward the spec (no re-analysis needed)
  - Changed/new: re-analyze → update or create feature-spec

## Writing rules

All `versions/` docs must:

- Be based on direct bundle analysis (no copying from official docs)
- Cite every behavioral claim: `분석 기준: CC v{X.X.X} bundle.js:{line}`
- Use pseudocode/Mermaid — never quote bundle code
- Keep obfuscated identifiers only in Appendix mapping tables

See [`docs/cc-gnothi-docs/WRITING_GUIDE.md`](docs/cc-gnothi-docs/WRITING_GUIDE.md) for full rules.

## License

Documentation: [CC BY-NC-SA 4.0](LICENSE)  
**No redistribution as a competing product. Attribution required. Non-commercial only.**

The analyzed Claude Code bundle is © Anthropic PBC. All rights reserved.  
This repository contains no bundle code — only verified behavioral specs written as pseudocode.

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/MyLittleLuckyDog/cc-gnothi</sub>
