---
type: index
cc_gnothi_version: "{VERSION}"
updated: "{YYYY-MM-DD}"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/ryujaeuk/cc-gnothi"
token_budget: 300
---

# cc-gnothi Index

## 런타임 정보
CC 버전: !`claude --version 2>/dev/null | head -1`
OS: !`uname -s`
아키텍처: !`uname -m`

## 파일 맵

| 파일 | 토픽 | 태그 | 토큰 |
|---|---|---|---|
| versions/v2.1.md | v2.1 변경사항 | version,changelog,v2.1 | ~600 |
| versions/v2.2.md | v2.2 변경사항 | version,changelog,v2.2 | ~600 |
| chapters/01-concepts.md | CC 아키텍처 개념 | concepts,architecture | ~800 |
| chapters/02-config.md | 설정 체계 | config,settings,claude.md | ~900 |
| chapters/03-commands.md | 슬래시 커맨드 | commands,slash | ~700 |
| chapters/04-mcp.md | MCP 설정/활용 | mcp,servers,tools | ~800 |
| chapters/05-skills.md | Skills/Plugin | skills,plugin,marketplace | ~700 |
| chapters/06-hooks.md | Hook 자동화 | hooks,automation | ~700 |
| chapters/07-agents.md | 멀티에이전트 | agents,subagents,parallel | ~800 |
| chapters/08-prompting.md | 프롬프트 작성법 | prompting,prompt,techniques | ~900 |
| chapters/09-output.md | 출력 포맷 제어 | output,format,templates | ~800 |
| chapters/10-patterns.md | 실전 워크플로우 | patterns,workflow,production | ~900 |
| reference/commands.md | 커맨드 레퍼런스 | reference,commands,flags | ~500 |
| reference/env-vars.md | 환경변수 목록 | reference,env,environment | ~400 |
| reference/flags.md | CLI 플래그 | reference,cli,flags | ~400 |

## 버전 매핑

| CC 버전 범위 | 권장 문서 |
|---|---|
| 2.0.x | versions/v2.0.md |
| 2.1.x | versions/v2.1.md |
| 2.2.x | versions/v2.2.md |

## 로드 우선순위

1. INDEX.md (현재 파일) — 항상 먼저
2. 감지된 버전의 versions/*.md
3. 질의 관련 chapters/*.md (QMD 검색 결과)
4. 필요 시 reference/*.md

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/ryujaeuk/cc-gnothi</sub>
