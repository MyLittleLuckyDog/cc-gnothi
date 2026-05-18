# cc-gnothi

> *γνῶθι σεαυτόν* — Know thyself.  
> Inscription above the entrance to the Oracle at Delphi, ~4th century BC.

**cc** = Claude Code. **gnothi** (γνῶθι) = know thyself.

The full phrase: **Claude Code, know thyself.**

---

Claude Code is a capable AI assistant. But there is one category of question it cannot answer well: questions about itself.

Ask it *"how does `/compact` actually decide what to summarize?"* and you get documentation-level generalities. Ask it *"what lifecycle events fire when I run `/clear`?"* and it tells you what the official docs say — not what the code does. That gap exists because Claude Code's behavior is version-specific and not fully reflected in official documentation.

**cc-gnothi** bridges that gap.

It produces verified, version-specific behavioral specs for every CC slash command and system prompt layer — derived from static analysis of each release. Those specs are served back to Claude Code through an MCP server embedded directly in the binary, so it can answer questions about its own internals with citation-level precision.

---

## What you get

**Claude Code stops guessing about itself.**

Install the MCP server and Claude Code gains access to three tools:

| Tool | What it does |
|---|---|
| `list_commands` | All known slash commands with description and type |
| `get_spec <command>` | Full behavioral spec in canonical section order |
| `query <text>` | Keyword search across all spec chunks (heading + tags + body) |

Ask Claude Code *"what happens when I run `/compact`?"* and it fetches the verified spec: exact phases, constants, side effects, common mistakes — all derived from source analysis of your exact CC version.

Ask it *"what behaviors in the system prompt are hardcoded vs overridable?"* and it returns a structured breakdown of CC's behavioral policy layer — what `CLAUDE.md` can influence, what it can't, and what instructions are redundant because they're already in the system context.

---

## Install

```bash
# macOS Apple Silicon
VER=$(curl -sL https://api.github.com/repos/MyLittleLuckyDog/cc-gnothi/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
curl -L "https://github.com/MyLittleLuckyDog/cc-gnothi/releases/download/${VER}/cc-gnothi-mcp-${VER}-aarch64-apple-darwin.tar.gz" \
  | tar xz && claude mcp add cc-gnothi -- ./cc-gnothi-mcp

# macOS Intel
VER=$(curl -sL https://api.github.com/repos/MyLittleLuckyDog/cc-gnothi/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
curl -L "https://github.com/MyLittleLuckyDog/cc-gnothi/releases/download/${VER}/cc-gnothi-mcp-${VER}-x86_64-apple-darwin.tar.gz" \
  | tar xz && claude mcp add cc-gnothi -- ./cc-gnothi-mcp

# Linux x86_64
VER=$(curl -sL https://api.github.com/repos/MyLittleLuckyDog/cc-gnothi/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
curl -L "https://github.com/MyLittleLuckyDog/cc-gnothi/releases/download/${VER}/cc-gnothi-mcp-${VER}-x86_64-unknown-linux-gnu.tar.gz" \
  | tar xz && claude mcp add cc-gnothi -- ./cc-gnothi-mcp

# Windows x86_64 (PowerShell)
$VER = (Invoke-RestMethod https://api.github.com/repos/MyLittleLuckyDog/cc-gnothi/releases/latest).tag_name
Invoke-WebRequest -Uri "https://github.com/MyLittleLuckyDog/cc-gnothi/releases/download/$VER/cc-gnothi-mcp-$VER-x86_64-pc-windows-msvc.exe" -OutFile cc-gnothi-mcp.exe
claude mcp add cc-gnothi -- ./cc-gnothi-mcp.exe
```

No configuration needed. The binary auto-detects your installed CC version and loads the matching embedded specs. If your exact version isn't embedded yet, it falls back to the closest available version with a warning.

---

## Current spec coverage

| CC Version | Commands | Verified |
|---|---|---|
| v2.1.132 | 84 | ✓ |
| v2.1.133 | 84 | ✓ |
| v2.1.139 | 84 | in progress |
| v2.1.141 | 84 | in progress |
| v2.1.142 | 84 | in progress |
| v2.1.143 | 84 | in progress |

Each spec is verified against the actual release — not inferred from official documentation. The pipeline re-analyzes only commands whose behavioral fingerprint changed between versions (~40% per minor release), copying the rest forward.

---

## How it works

### Slash command specs (Phase 1)

```
CC release (per version)
  ↓  static analysis — command behavior, lifecycle, side effects
  ↓  structural fingerprint for version diffing
  ↓
Claude API — 8-section spec per changed command:
  Overview · Registration · Input Branching · Behavioral Spec
  State & Side Effects · Common Mistakes · Version History · Appendix
  ↓
versions/v{X.X.X}/{command}.md  — bundle_verified: true
```

### System context analysis (Phase 2)

```
CC release (per version)
  ↓  behavioral policy extraction:
     hardcoded constraints, default behaviors,
     tool permission model, system prompt layers
  ↓
Claude API — behavioral paraphrase (no verbatim reproduction):
  Overview · Hardcoded Constraints · Default Behaviors
  CLAUDE.md Redundancy Warning · User Actionable Insights
  Tool & Permission Layer · Version Notes · Appendix
  ↓
versions/v{X.X.X}/_system-context.md  — bundle_verified: true
```

```
cc-gnothi-mcp (Rust, rust-embed) — all versions embedded at compile time
  ↓
Claude Code  ←  MCP stdio  ←  list_commands / get_spec / query

  query("system prompt hardcoded")  →  _system-context chunks
  query("compact")                  →  /compact spec chunks
```

New CC releases are detected automatically, analyzed overnight, and pushed to this repo. The MCP binary is rebuilt and tagged as a new release.

---

## The origin

This project started for a mundane reason: a 2013 Mac Pro with an Ivy Bridge CPU cannot run Claude Code past v2.1.112, because newer builds require AVX2 instructions that Ivy Bridge doesn't have.

The workaround — analyzing each CC release on a compatible machine — turned out to produce something more generally useful: a system that gives any Claude Code installation deep, accurate knowledge of its own behavior.

The name is the whole thesis. The most powerful AI coding assistant available, and it didn't know itself. Now it does.

---

## Repository structure

```
cc-gnothi/
├── versions/v{X.X.X}/            Verified behavioral specs per version
│   ├── {command}.md               Slash command spec (8-section)
│   └── _system-context.md         System prompt layer analysis (Phase 2)
├── scripts/                       Analysis pipeline
│   ├── extract-ast.js             Static analysis — command index + system context extraction
│   ├── call-api.js                Anthropic SDK wrapper with rate-limit handling
│   ├── analyze-all.sh             Slash command batch runner (diff-based)
│   ├── analyze-system-context.sh  System context runner (per version)
│   └── sync.sh                    Cron entrypoint: pull → diff → analyze → push
└── src/                           cc-gnothi-mcp (Rust MCP server)
    └── src/
        ├── main.rs                Version auto-detect, embedded/disk/fetch dispatch
        ├── loader.rs              Markdown → Chunk parser (disk + rust-embed)
        ├── store.rs               get_spec, list_commands, query (QMD scoring)
        └── server.rs              rmcp tool handlers
```

---

## License

Behavioral specs: [CC BY-NC-SA 4.0](LICENSE) — attribution required, non-commercial, share-alike.  
MCP server source (`src/`): AGPL-3.0-only.

Claude Code is © Anthropic PBC. This repository contains no Claude Code source code or bundle content — only original behavioral documentation written with factual accuracy.

---

<sub>© 2026 ryujaeuk · ryujaeuk@gmail.com · github.com/MyLittleLuckyDog/cc-gnothi</sub>
