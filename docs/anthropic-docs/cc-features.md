---
type: reference
source:
  - https://code.claude.com/docs/en/memory
  - https://code.claude.com/docs/en/mcp
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/skills
  - https://code.claude.com/docs/en/sub-agents
updated: 2026-05-17
stale_risk: high  # 공식 문서 기반. bundle 분석과 충돌 시 bundle 우선.
---

# Claude Code 핵심 기능 레퍼런스

## Memory

세션이 끝나면 컨텍스트가 초기화된다. 두 가지 메커니즘이 지식을 세션 간에 유지한다: 직접 작성하는 **CLAUDE.md 파일**과 Claude가 스스로 기록하는 **Auto memory**.

### CLAUDE.md 파일 위치 (로드 우선순위: 낮음 → 높음)

| 범위 | 위치 | 공유 대상 |
|------|------|-----------|
| Managed policy | `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS) | 조직 전체 |
| User | `~/.claude/CLAUDE.md` | 본인 (전 프로젝트) |
| Project | `./CLAUDE.md` 또는 `./.claude/CLAUDE.md` | 팀 (버전 관리) |
| Local | `./CLAUDE.local.md` (`.gitignore`에 추가 권장) | 본인 (현재 프로젝트만) |

파일 임포트: `@path/to/file` 구문으로 다른 파일을 인라인 포함 (최대 5단계 재귀).

```markdown
See @README for project overview and @package.json for available npm commands.

# Additional Instructions
- git workflow @docs/git-instructions.md
```

### Path-scoped rules (`.claude/rules/`)

특정 파일 경로에만 적용되는 규칙. 매칭 파일 작업 시에만 컨텍스트에 로드된다.

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API Development Rules
- All API endpoints must include input validation
```

### Auto memory

- **요구 버전**: Claude Code v2.1.59 이상
- **저장 위치**: `~/.claude/projects/<project>/memory/MEMORY.md` (git repo 기준)
- **로드 범위**: 세션 시작 시 `MEMORY.md` 첫 200줄 또는 25KB 자동 주입
- **토글**: `/memory` 명령 또는 `"autoMemoryEnabled": false` 설정

### 주의사항

- CLAUDE.md는 시스템 프롬프트가 아닌 사용자 메시지로 주입된다. 강제 준수 아님
- 파일이 200줄을 초과하면 준수율이 떨어진다 → path-scoped rules로 분산
- `/compact` 후 루트 CLAUDE.md는 재주입되지만 서브디렉토리 파일은 재로드 안 됨
- Managed policy CLAUDE.md는 `claudeMdExcludes` 설정으로 제외 불가

---

## MCP (Model Context Protocol)

Claude Code가 외부 도구·데이터 소스와 연결하는 오픈 표준. 이슈 트래커, 모니터링 대시보드, DB 등에 Claude가 직접 접근할 수 있다.

### 서버 추가 방법

| 방식 | 명령어 예시 |
|------|-------------|
| HTTP (권장) | `claude mcp add --transport http notion https://mcp.notion.com/mcp` |
| SSE (deprecated) | `claude mcp add --transport sse asana https://mcp.asana.com/sse` |
| stdio (로컬) | `claude mcp add --transport stdio --env KEY=val myserver -- npx server` |

```bash
# 관리 명령
claude mcp list
claude mcp get github
claude mcp remove github
/mcp   # 세션 내 상태 확인
```

### 범위(scope) 옵션

| 값 | 설명 |
|----|------|
| `local` (기본) | 현재 프로젝트, 본인만 |
| `project` | 현재 프로젝트, `.mcp.json`으로 팀 공유 |
| `user` | 전 프로젝트, 본인만 |

### 주의사항

- `workspace`는 예약된 서버 이름 → 사용 금지
- HTTP/SSE 서버 연결 끊김 시 최대 5회 지수 백오프 재연결 (stdio는 재연결 없음)
- MCP 도구 출력이 10,000 토큰 초과 시 경고. 상한선 변경: `MAX_MCP_OUTPUT_TOKENS` 환경변수
- 외부 콘텐츠를 fetch하는 서버는 프롬프트 인젝션 위험 → 신뢰할 수 있는 서버만 연결

---

## Hooks

Claude Code 라이프사이클의 특정 지점에서 자동 실행되는 쉘 명령·HTTP 요청·LLM 프롬프트. Claude의 결정과 무관하게 확정적으로 실행된다.

### 주요 이벤트

| 실행 주기 | 이벤트 |
|-----------|--------|
| 세션당 1회 | `SessionStart`, `SessionEnd` |
| 턴당 1회 | `UserPromptSubmit`, `Stop`, `StopFailure` |
| 툴 호출당 | `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest` |
| 기타 비동기 | `FileChanged`, `PreCompact`, `PostCompact`, `SubagentStart`, `SubagentStop` 등 |

### 설정 구조

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/validate.sh"
          }
        ]
      }
    ]
  }
}
```

### 훅 타입

| 타입 | 설명 |
|------|------|
| `command` | 쉘 명령 실행 (stdin으로 JSON 수신) |
| `http` | POST 요청 전송 |
| `mcp_tool` | 연결된 MCP 서버 도구 호출 |
| `prompt` | Claude 모델에 yes/no 판단 위임 |
| `agent` | 서브에이전트 생성 (실험적) |

### 종료 코드 동작

| 코드 | 의미 |
|------|------|
| `0` | 성공 → stdout에서 JSON 파싱 |
| `2` | 블로킹 오류 → stderr를 Claude에 전달, 액션 차단 |
| 기타 | 비블로킹 오류 → stderr를 트랜스크립트에 표시, 실행 계속 |

### 주의사항

- 종료 코드 `1`은 비블로킹. 액션을 막으려면 반드시 `2` 사용
- stdout은 10,000자로 제한
- `/dev/tty` 접근 불가 → 터미널 알림은 `terminalSequence` JSON 필드 사용
- 동일한 핸들러는 자동 중복 제거됨

---

## Skills

반복적으로 입력하는 절차나 지침을 `/skill-name`으로 호출 가능한 단위로 패키징. CLAUDE.md와 달리 호출 시에만 컨텍스트에 로드된다.

### 저장 위치

| 위치 | 범위 |
|------|------|
| `~/.claude/skills/<name>/SKILL.md` | 전 프로젝트 (개인) |
| `.claude/skills/<name>/SKILL.md` | 현재 프로젝트 (팀) |
| `<plugin>/skills/<name>/SKILL.md` | 플러그인 활성화 시 |

### SKILL.md 프론트매터

```yaml
---
name: my-skill
description: Claude가 자동 로드 여부 판단에 사용하는 설명 (필수 권장)
disable-model-invocation: true  # Claude 자동 호출 방지, 사용자만 /name으로 실행
user-invocable: false           # /menu에서 숨김, Claude만 호출 가능
allowed-tools: Bash(git add *) Bash(git commit *)  # 승인 없이 허용할 도구
context: fork                   # 포크된 서브에이전트에서 실행
model: haiku                    # 이 스킬 실행 시 사용할 모델
effort: low                     # 노력 수준 오버라이드
paths:
  - "src/**/*.ts"               # 해당 경로 파일 작업 시에만 자동 활성화
---
```

### 동적 컨텍스트 주입

`` !`command` `` 구문으로 쉘 명령을 실행하고 출력을 인라인 삽입.

```yaml
---
name: summarize-changes
description: 커밋되지 않은 변경사항 요약
---

## Current changes
!`git diff HEAD`

## Instructions
위 변경사항을 2-3줄로 요약하고 위험 요소를 나열하세요.
```

### 인수 치환

| 변수 | 설명 |
|------|------|
| `$ARGUMENTS` | 호출 시 전달된 전체 인수 |
| `$ARGUMENTS[N]` 또는 `$N` | N번째 인수 (0-based) |
| `${CLAUDE_SKILL_DIR}` | 스킬 디렉토리 절대 경로 |
| `${CLAUDE_SESSION_ID}` | 현재 세션 ID |

### 주의사항

- 스킬 내용은 호출 후 세션 전체에 걸쳐 컨텍스트에 잔존 (재로드 없음)
- `/compact` 후 스킬은 최대 5,000토큰까지 재첨부되며 전체 예산 25,000토큰
- `description` + `when_to_use` 합산 1,536자 초과 시 잘림 → 핵심 문구를 앞에 배치
- 스킬 수가 많으면 설명 예산 초과 → `/doctor`로 확인, `skillListingBudgetFraction` 설정으로 조정

---

## Agents (Sub-agents)

특정 작업 유형을 처리하는 전문화된 AI 어시스턴트. 탐색 결과나 로그가 메인 대화를 오염시키지 않도록 별도 컨텍스트 창에서 실행된다.

### 내장 서브에이전트

| 에이전트 | 모델 | 용도 |
|----------|------|------|
| `Explore` | Haiku | 읽기 전용 코드베이스 탐색 |
| `Plan` | 상속 | 플랜 모드에서 컨텍스트 수집 |
| `general-purpose` | 상속 | 탐색+수정이 모두 필요한 복합 작업 |

### 파일 구조 및 위치

```
.claude/agents/code-reviewer.md   # 프로젝트 범위 (팀 공유)
~/.claude/agents/code-reviewer.md # 사용자 범위 (전 프로젝트)
```

```markdown
---
name: code-reviewer
description: 코드 품질과 보안을 검토. 코드 변경 후 자동 적용
tools: Read, Glob, Grep
model: sonnet
permissionMode: acceptEdits
memory: project
---

You are a code reviewer. Analyze code and provide actionable feedback.
```

### 프론트매터 주요 필드

| 필드 | 설명 |
|------|------|
| `name` | 소문자와 하이픈 (필수) |
| `description` | 위임 시점 결정에 사용 (필수) |
| `tools` | 허용 도구 allowlist (미지정 시 전체 상속) |
| `disallowedTools` | 제외할 도구 denylist |
| `model` | `sonnet`, `opus`, `haiku`, `inherit`, 또는 전체 모델 ID |
| `permissionMode` | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan` |
| `memory` | `user`, `project`, `local` — 세션 간 지식 축적 |
| `skills` | 시작 시 주입할 스킬 목록 (전체 내용 로드) |
| `maxTurns` | 최대 에이전틱 턴 수 |
| `isolation` | `worktree` — 임시 git worktree에서 격리 실행 |
| `background` | `true` — 항상 백그라운드 태스크로 실행 |

### 영구 메모리 범위

| 값 | 저장 위치 | 공유 |
|----|-----------|------|
| `user` | `~/.claude/agent-memory/<name>/` | 전 프로젝트 |
| `project` | `.claude/agent-memory/<name>/` | 팀 (버전 관리) |
| `local` | `.claude/agent-memory-local/<name>/` | 개인, 버전 관리 제외 |

### 주의사항

- 서브에이전트는 다른 서브에이전트를 생성할 수 없음 (중첩 금지)
- `bypassPermissions`는 부모가 사용 중이면 덮어쓸 수 없음
- 플러그인 서브에이전트는 `hooks`, `mcpServers`, `permissionMode` 무시됨
- 파일을 직접 수정한 경우 세션 재시작 필요 (`/agents` UI는 즉시 반영)
- `skills` 필드에는 `disable-model-invocation: true`인 스킬 지정 불가
