---
type: chapter
chapter: "01"
title: "CC 아키텍처 개념"
cc_version_min: "2.1.0"
updated: 2026-05-17
tags: ["architecture", "concepts", "execution-model", "context", "tools", "permissions", "memory", "interactive", "headless", "mcp"]
related:
  - chapters/02-config.md
  - chapters/03-commands.md
  - chapters/04-mcp.md
  - chapters/06-hooks.md
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
---

# CC 아키텍처 개념

> 이 챕터: CC가 어떤 레이어로 구성되어 있는지 — 환경, 실행 모델, 컨텍스트, 도구, 권한, 메모리 — 개념 레이어만 다룬다.  
> 최소 버전: v2.1.0

## 개념

CC는 **에이전틱 하네스(agentic harness)**다. Claude 모델에 도구·컨텍스트 관리·실행 환경을 붙여 coding agent로 만든 레이어다. 핵심 루프: `컨텍스트 수집 → 액션 → 결과 검증 → 반복`.

---

## 패턴

### 1. 실행 환경

| 환경 | 코드 실행 위치 | 주요 특징 |
|---|---|---|
| **Terminal (CLI)** | 로컬 머신 | `claude` 명령어. 전체 기능. |
| **VS Code / JetBrains** | 로컬 머신 | 인라인 diff, 에디터 통합 |
| **Desktop App** | 로컬 머신 | 시각적 diff, 멀티 세션, 예약 실행 |
| **Web (claude.ai/code)** | Anthropic VM (Cloud) | 로컬 미설치 가능, 장시간 태스크 |
| **Remote Control** | 로컬 머신 (브라우저로 제어) | 로컬 환경 유지 + 원격 접근 |

> 모든 환경에서 동일한 에이전틱 루프. CLAUDE.md·settings·MCP 서버 공유.

---

### 2. 실행 모드

| 모드 | 진입 방법 | 특징 |
|---|---|---|
| **Interactive** | `claude` | REPL. 사람이 개입·수정. 스킬·내장 커맨드 사용 가능 |
| **Non-interactive (`-p`)** | `claude -p "prompt"` | stdin/stdout. CI·스크립트용. 스킬·`/commands` 불가 |
| **Bare (`--bare`)** | `claude --bare -p "..."` | hooks·MCP·skills·CLAUDE.md 자동 탐색 스킵. 최소 환경 |
| **Agent (Background)** | Routines / Desktop scheduled | 원격 인프라 또는 로컬 스케줄. 사람 개입 없음 |

```bash
# Non-interactive 예시
claude -p "Run the test suite and fix failures" --allowedTools "Bash,Read,Edit"

# Bare mode — CI 권장
claude --bare -p "Summarize this file" --allowedTools "Read"

# 파이프
git diff main --name-only | claude -p "review for security issues"
```

---

### 3. 컨텍스트 시스템

CC가 세션 시작 시 읽는 정보 레이어 (우선순위: 낮음 → 높음):

| 레이어 | 소스 | 비고 |
|---|---|---|
| Managed policy | `/Library/Application Support/ClaudeCode/CLAUDE.md` | 조직 전체, 오버라이드 불가 |
| User | `~/.claude/CLAUDE.md` | 개인, 전 프로젝트 |
| Project | `./CLAUDE.md` or `./.claude/CLAUDE.md` | 팀 공유, 버전 관리 |
| Local | `./CLAUDE.local.md` | 개인, 현재 프로젝트만 |
| Auto memory | `~/.claude/projects/<project>/memory/MEMORY.md` (첫 200줄/25KB) | v2.1.59+ |
| Path-scoped rules | `.claude/rules/*.md` (paths 매칭 시만) | 매칭 파일 작업 시 로드 |
| MCP servers | `.mcp.json` / `settings.json` | 외부 서비스 컨텍스트 |

> `--bare` 모드에서는 위 자동 탐색 전체 스킵. 명시적 플래그만 적용.

---

### 4. 도구 시스템

| 카테고리 | 내장 도구 | 설명 |
|---|---|---|
| 파일 | `Read`, `Edit`, `Write`, `MultiEdit` | 파일 읽기·수정·생성 |
| 검색 | `Glob`, `Grep` | 패턴 검색, 정규식 검색 |
| 실행 | `Bash` | 쉘 명령 실행 |
| 웹 | `WebFetch`, `WebSearch` | 문서 조회, 웹 검색 |
| 오케스트레이션 | `Task` (subagent) | 서브에이전트 생성·위임 |

**MCP 도구**: 내장 도구 위에 쌓이는 레이어. 연결된 MCP 서버가 제공하는 추가 도구. 컨텍스트 비용은 세션 시작 시 이름만, 실제 사용 시 스키마 로드.

```bash
# MCP 도구 현황 확인
/mcp

# MCP 서버 추가
claude mcp add --transport http notion https://mcp.notion.com/mcp
```

---

### 5. 권한 모델

**평가 순서: deny → ask → allow** (첫 매칭 규칙 적용)

| 레벨 | 동작 |
|---|---|
| `allow` | 묻지 않고 자동 실행 |
| `ask` (기본) | 매번 사용자 확인 요청 |
| `deny` | 실행 차단 |

**Permission Mode** (`Shift+Tab`으로 토글):

| 모드 | 동작 |
|---|---|
| `default` | 파일 편집·쉘 명령에 확인 요청 |
| `acceptEdits` | 파일 편집 자동 승인. 기타 명령은 여전히 확인 |
| `plan` | 읽기 전용. 플랜 작성 후 승인 시 실행 |
| `auto` | 백그라운드 안전 검사로 자동 평가 (리서치 프리뷰) |
| `dontAsk` | 최소 프롬프트 (CI용) |
| `bypassPermissions` | 권한 체크 전체 스킵 (`--dangerously-skip-permissions` 필요) |

```json
// .claude/settings.json
{
  "permissions": {
    "allow": ["Bash(npm run test *)", "Read(./src/**)"],
    "deny":  ["Bash(curl *)", "Read(./.env)"]
  }
}
```

---

### 6. 메모리 모델

| 종류 | 범위 | 지속성 | 용도 |
|---|---|---|---|
| **대화 컨텍스트** | 현재 세션 컨텍스트 창 | 세션 종료 시 소멸 | 대화 내 작업 흐름 |
| **CLAUDE.md** | 세션 시작 시 자동 주입 | 파일 삭제 전까지 영구 | 팀 규칙·아키텍처·코딩 표준 |
| **Auto memory** | `MEMORY.md` 첫 200줄/25KB | CC가 자동 기록·갱신 | 빌드 명령·디버깅 인사이트 |
| **외부 메모리 (MCP)** | MCP 서버 제공 | 서버 의존 | DB·이슈 트래커·문서 시스템 |

> CLAUDE.md는 시스템 프롬프트가 아닌 **사용자 메시지로 주입**됨 — 강제 준수 아님.  
> 200줄 초과 시 준수율 저하 → `.claude/rules/`로 분산 권장.

---

## 버전별 차이

| 기능 | v2.0.x | v2.1.x |
|---|---|---|
| Auto memory | 미지원 | v2.1.59+ 지원 (`~/.claude/projects/.../MEMORY.md`) |
| `--bare` 모드 | 미지원 | 지원 (CI 권장, 향후 `-p` 기본값 예정) |
| Path-scoped rules | 미지원 | `.claude/rules/` 지원 |
| MCP tool search (deferred) | 미지원 | 지원 — 이름만 로드, 사용 시 스키마 fetch |
| stdin 상한 | 불명 | 10MB (v2.1.128+) |

---

## 자주 하는 실수

1. **CLAUDE.md를 200줄 이상 작성** — 준수율 저하. `.claude/rules/`로 경로별 분산.
2. **Interactive 전용 `/commands`를 `-p` 모드에서 기대** — `-p`에서는 동작 설명을 직접 프롬프트에 포함.
3. **`--bare` 없이 CI에서 `claude -p` 사용** — 로컬 hooks·MCP가 CI 머신에 없으면 예측 불가 동작.
4. **deny 규칙 없이 allow만 설정** — 기본은 `ask`이므로 CI가 중단됨. `dontAsk` 모드 또는 명시적 deny 추가.
5. **세션 간 컨텍스트 공유를 가정** — 각 세션은 독립. 지속 정보는 CLAUDE.md 또는 Auto memory에.

---

## 참고

- 공식 개요: https://code.claude.com/docs/en/overview
- 실행 아키텍처: https://code.claude.com/docs/en/how-claude-code-works
- Non-interactive: https://code.claude.com/docs/en/headless
- Settings/권한: https://code.claude.com/docs/en/settings
- 관련 챕터: `chapters/02-config.md`, `chapters/04-mcp.md`, `chapters/06-hooks.md`

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/ryujaeuk/cc-gnothi</sub>
