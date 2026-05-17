# cc-gnothi

> **Documentation for CC, not for humans.**  
> A self-aware MCP system that lets Claude Code understand its own version and capabilities — and act on that knowledge.

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![GitHub release](https://img.shields.io/github/v/release/ryujaeuk/cc-gnothi)](https://github.com/ryujaeuk/cc-gnothi/releases)

English | [한국어](README.md)

---

## Concept

Official docs are well-written. The problem is that humans read them.

Information gets lost in translation — human reads docs, human interprets, human instructs CC.  
cc-gnothi removes that middle layer.

```
Traditional:  docs → human reads → human instructs CC → CC acts
cc-gnothi:    docs → CC loads directly → CC acts optimally
                      human only sees results
```

> *γνῶθι σεαυτόν — Know thyself*  
> CC knows its own version, features, and limits.

---

## Why

AI digests documentation better than humans do.

The official Claude Code docs cover prompting techniques, output templates, and version-specific behaviors in detail — but almost nobody reads them. cc-gnothi makes CC read them instead, at the right time, in the right context.

---

## Install

### Plugin (recommended)

```bash
/plugin marketplace add ryujaeuk/cc-gnothi
/plugin install cc-gnothi@ryujaeuk
```

### Manual

```bash
curl -L https://github.com/ryujaeuk/cc-gnothi/releases/latest/download/cc-gnothi-mcp-$(uname -s)-$(uname -m) \
  -o ~/.claude/bin/cc-gnothi-mcp
chmod +x ~/.claude/bin/cc-gnothi-mcp
```

MCP config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "cc-gnothi": {
      "command": "~/.claude/bin/cc-gnothi-mcp",
      "transport": "stdio"
    }
  }
}
```

---

## How it works

```
CC starts
  → cc-gnothi-mcp launches
  → detects claude --version
  → loads version-matched docs
    (downloads from GitHub Releases if missing)
  → indexes with QMD (BM25 + vector)
  → ready to serve

User query
  → relevant chunks extracted via BM25 + vector search
  → injected into CC context as JSON
  → CC responds with version-optimized guidance
```

---

## Repository structure

```
/versions/       Per-version guides (v2.x.md)
/chapters/       Topic-based chapters
/templates/      Document authoring templates
/src/            cc-gnothi-mcp Rust source
```

---

## Version index

| CC Version | Docs | Key changes |
|---|---|---|
| Latest | [releases](https://github.com/ryujaeuk/cc-gnothi/releases) | |

---

## License

Documentation: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)  
Source code: MIT

Non-commercial sharing with attribution is permitted.  
Commercial redistribution is prohibited.  
Derivative works must use the same license.

---

<sub>
© 2026 ryujaeuk | ryujaeuk@gmail.com  
<a href="https://github.com/ryujaeuk/cc-gnothi">github.com/ryujaeuk/cc-gnothi</a>
</sub>
