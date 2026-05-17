---
type: chapter
chapter: "07"
title: "멀티에이전트 — 서브에이전트와 Agent SDK"
cc_version_min: "2.1.0"
updated: 2026-05-17
tags: ["agents", "sub-agents", "task-tool", "parallel", "agent-sdk", "delegation", "context-isolation", "automation", "multi-agent"]
related:
  - chapters/01-concepts.md
  - chapters/04-mcp.md
  - chapters/06-hooks.md
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
---

# 멀티에이전트 — 서브에이전트와 Agent SDK

> 이 챕터: 서브에이전트의 개념, 생성·설정, 병렬 실행 패턴, Agent SDK를 다룬다.  
> 최소 버전: v2.1.0 (Task 도구); v2.1.63부터 Task → Agent 도구 이름 변경

## 개념

**서브에이전트(Subagent)**는 CC 세션 안에서 독립된 컨텍스트 창을 열어 실행되는 전문화 AI 어시스턴트다.

- 탐색 결과·로그·파일 내용이 메인 대화를 오염시키지 않도록 별도 컨텍스트에서 실행됨
- 작업 완료 후 요약만 메인 대화로 반환
- 커스텀 시스템 프롬프트·도구 제한·독립 권한으로 각각 설정 가능

**언제 서브에이전트를 쓰나:**

| 상황 | 서브에이전트 적합 | 메인 대화 적합 |
|---|---|---|
| 테스트 실행 / 로그 처리 등 대량 출력 | O | X |
| 자급자족 가능한 독립 작업 | O | X |
| 반복적으로 같은 종류 작업 위임 | O | X |
| 잦은 되묻기·반복 수정 필요 | X | O |
| 계획 → 구현 → 테스트 공유 컨텍스트 필요 | X | O |
| 빠른 단발성 변경 | X | O |

> **서브에이전트는 다른 서브에이전트를 생성할 수 없다** (중첩 금지).  
> 세션을 넘어서는 병렬 실행은 [background agents](/en/agent-view) 참고.

---

## 패턴

### 1. 내장 서브에이전트

CC가 상황에 따라 자동으로 사용하는 빌트인 에이전트들:

| 에이전트 | 모델 | 도구 | 자동 사용 시점 |
|---|---|---|---|
| `Explore` | Haiku | 읽기 전용 | 코드베이스 탐색·검색 |
| `Plan` | 상속 | 읽기 전용 | plan 모드에서 컨텍스트 수집 |
| `general-purpose` | 상속 | 전체 | 탐색+수정이 모두 필요한 복합 작업 |
| `statusline-setup` | Sonnet | - | `/statusline` 실행 시 |
| `claude-code-guide` | Haiku | - | CC 기능 질문 시 |

`Explore`는 호출 시 thoroughness 레벨을 지정한다: **quick** / **medium** / **very thorough**.

---

### 2. 커스텀 서브에이전트 파일 정의

서브에이전트는 YAML frontmatter + Markdown 본문으로 구성된 `.md` 파일이다.

**저장 위치 (우선순위: 높음 → 낮음):**

| 위치 | 스코프 | 우선순위 |
|---|---|---|
| Managed settings | 조직 전체 | 1 (최고) |
| `--agents` CLI 플래그 | 현재 세션만 | 2 |
| `.claude/agents/` | 현재 프로젝트 (팀 공유) | 3 |
| `~/.claude/agents/` | 전 프로젝트 (개인) | 4 |
| 플러그인 `agents/` 디렉토리 | 플러그인 활성화 범위 | 5 (최저) |

같은 이름이 여러 위치에 있으면 더 높은 우선순위 정의가 적용된다.

**파일 구조 예시:**

```markdown
---
name: code-reviewer
description: 코드 품질과 보안을 검토. 코드 변경 후 자동 사용.
tools: Read, Glob, Grep
model: sonnet
permissionMode: default
memory: project
---

You are a code reviewer. Analyze code and provide actionable feedback.
```

---

### 3. Frontmatter 필드 전체 목록

| 필드 | 필수 | 설명 |
|---|---|---|
| `name` | **필수** | 소문자+하이픈. hooks의 `agent_type`으로 전달됨 |
| `description` | **필수** | Claude가 위임 시점 결정에 사용. "proactively" 포함 시 더 적극적으로 사용됨 |
| `tools` | 선택 | 허용 도구 allowlist. 생략 시 전체 상속 |
| `disallowedTools` | 선택 | 제외 도구 denylist |
| `model` | 선택 | `sonnet`, `opus`, `haiku`, `inherit`, 또는 전체 모델 ID. 기본 `inherit` |
| `permissionMode` | 선택 | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | 선택 | 최대 에이전틱 턴 수 |
| `skills` | 선택 | 시작 시 주입할 스킬 목록 (전체 내용 로드) |
| `mcpServers` | 선택 | 이 서브에이전트 전용 MCP 서버 (inline 정의 또는 이름 참조) |
| `hooks` | 선택 | 이 서브에이전트 활성 중에만 적용되는 라이프사이클 훅 |
| `memory` | 선택 | `user`, `project`, `local` — 세션 간 지식 축적 |
| `background` | 선택 | `true`로 설정 시 항상 백그라운드 태스크로 실행 |
| `effort` | 선택 | `low`, `medium`, `high`, `xhigh`, `max` — 세션 수준 오버라이드 |
| `isolation` | 선택 | `worktree` — 임시 git worktree에서 격리 실행 |
| `color` | 선택 | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` |
| `initialPrompt` | 선택 | `--agent` 또는 `agent` 설정으로 메인 세션 에이전트로 실행 시 첫 유저 턴에 자동 제출 |

> **플러그인 서브에이전트**는 보안상 `hooks`, `mcpServers`, `permissionMode` 무시됨.

---

### 4. 모델 선택 우선순위

서브에이전트 모델 결정 순서 (높음 → 낮음):

1. `CLAUDE_CODE_SUBAGENT_MODEL` 환경변수
2. 호출 시 per-invocation `model` 파라미터
3. 서브에이전트 정의 파일의 `model` frontmatter
4. 메인 대화의 모델

---

### 5. 퍼미션 모드

| 모드 | 동작 |
|---|---|
| `default` | 표준 퍼미션 확인 + 프롬프트 |
| `acceptEdits` | 워킹 디렉토리 내 파일 편집 자동 승인 |
| `auto` | 백그라운드 분류기가 명령 검토 |
| `dontAsk` | 퍼미션 프롬프트 자동 거부 (명시 허용 도구는 작동) |
| `bypassPermissions` | 퍼미션 체크 전체 스킵 |
| `plan` | 읽기 전용 |

> 부모 세션이 `bypassPermissions` 또는 `acceptEdits`를 사용 중이면 서브에이전트 설정으로 **오버라이드 불가**.  
> 부모가 `auto` 모드이면 서브에이전트의 `permissionMode`는 **무시**되고 `auto`가 강제된다.

---

### 6. 영구 메모리

| `memory` 값 | 저장 위치 | 공유 |
|---|---|---|
| `user` | `~/.claude/agent-memory/<name>/` | 전 프로젝트 |
| `project` | `.claude/agent-memory/<name>/` | 팀 (버전 관리) |
| `local` | `.claude/agent-memory-local/<name>/` | 개인, 버전 관리 제외 |

- 메모리 활성화 시 `MEMORY.md` 첫 200줄 또는 25KB를 시스템 프롬프트에 주입
- Read/Write/Edit 도구가 자동 활성화됨
- 권장 스코프: `project` (팀 공유 + 버전 관리 가능)

---

### 7. 서브에이전트 호출 방법

| 방법 | 문법 | 특징 |
|---|---|---|
| 자연어 | `"Use the code-reviewer agent..."` | Claude가 위임 여부 결정 |
| @-mention | `@"code-reviewer (agent)" look at changes` | 해당 서브에이전트 강제 실행 |
| CLI 플래그 | `claude --agent code-reviewer` | 세션 전체를 서브에이전트 시스템 프롬프트로 실행 |
| 설정 파일 | `.claude/settings.json`의 `"agent"` 필드 | 프로젝트 기본값 |

```bash
# 세션 전체를 code-reviewer 에이전트로 실행
claude --agent code-reviewer

# CLI로 임시 에이전트 정의 (세션 종료 시 소멸)
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer.",
    "tools": ["Read", "Grep", "Glob"],
    "model": "sonnet"
  }
}'
```

```json
// .claude/settings.json — 프로젝트 기본 에이전트
{
  "agent": "code-reviewer"
}
```

---

### 8. 포그라운드 vs 백그라운드 실행

| 구분 | 동작 |
|---|---|
| **포그라운드** | 메인 대화 블로킹. 퍼미션 프롬프트 사용자에게 전달 |
| **백그라운드** | 메인 대화와 동시 실행. 퍼미션이 없으면 자동 거부 |

```text
# 백그라운드 실행 요청
"Run this in the background"

# Ctrl+B: 실행 중인 태스크를 백그라운드로 전환
```

> `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`로 백그라운드 기능 전체 비활성화 가능.

---

### 9. 병렬 실행 패턴

독립적인 작업을 동시에 여러 서브에이전트에 위임하는 패턴:

```text
Research the authentication, database, and API modules
in parallel using separate subagents
```

각 서브에이전트가 독립적으로 탐색 후 Claude가 결과를 종합한다.

> **주의**: 여러 서브에이전트의 결과가 메인 대화로 합쳐지면 컨텍스트를 상당히 소모함.  
> 지속적 병렬화나 컨텍스트 창 한도 초과 시 [agent teams](/en/agent-teams) 사용 권장.

**체인 패턴** — 순서 의존 작업:

```text
Use the code-reviewer subagent to find performance issues,
then use the optimizer subagent to fix them
```

---

### 10. Fork 서브에이전트 (v2.1.117+, 실험적)

일반 서브에이전트와 달리 **현재 대화 전체를 그대로 상속**해 실행되는 서브에이전트.

```bash
# 환경변수로 활성화
export CLAUDE_CODE_FORK_SUBAGENT=1

# /fork 명령으로 포크 생성
/fork draft unit tests for the parser changes so far
```

| | Fork | 일반 서브에이전트 |
|---|---|---|
| 컨텍스트 | 전체 대화 히스토리 상속 | 신선한 컨텍스트 |
| 시스템 프롬프트 | 메인 세션과 동일 | 정의 파일에서 로드 |
| 모델 | 메인 세션과 동일 | `model` 필드 |
| 프롬프트 캐시 | 메인 세션과 공유 (비용 절감) | 별도 캐시 |
| 포크 중첩 | 불가 | 불가 |

> Fork 모드 활성화 시 일반 서브에이전트 스폰도 모두 백그라운드로 실행됨.

---

### 11. 서브에이전트 비활성화

특정 서브에이전트를 막고 싶을 때:

```json
// .claude/settings.json
{
  "permissions": {
    "deny": ["Agent(Explore)", "Agent(my-custom-agent)"]
  }
}
```

```bash
# CLI 플래그로 비활성화
claude --disallowedTools "Agent(Explore)"
```

---

### 12. Agent SDK

외부 프로세스(Python/TypeScript)에서 CC 에이전트 루프를 프로그래밍하는 라이브러리.

**설치:**

```bash
# Python
pip install claude-agent-sdk

# TypeScript
npm install @anthropic-ai/claude-agent-sdk
```

**인증:**

```bash
export ANTHROPIC_API_KEY=your-api-key
```

서드파티 제공자도 지원:

| 제공자 | 환경변수 |
|---|---|
| Amazon Bedrock | `CLAUDE_CODE_USE_BEDROCK=1` + AWS credentials |
| Claude Platform on AWS | `CLAUDE_CODE_USE_ANTHROPIC_AWS=1` + `ANTHROPIC_AWS_WORKSPACE_ID` |
| Google Vertex AI | `CLAUDE_CODE_USE_VERTEX=1` + GCP credentials |
| Microsoft Azure | `CLAUDE_CODE_USE_FOUNDRY=1` + Azure credentials |

**기본 사용법:**

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Find and fix the bug in auth.py",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Bash"]),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.ts",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  if ("result" in message) console.log(message.result);
}
```

**SDK에서 커스텀 서브에이전트 정의:**

```python
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

async for message in query(
    prompt="Use the code-reviewer agent to review this codebase",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Glob", "Grep", "Agent"],
        agents={
            "code-reviewer": AgentDefinition(
                description="Expert code reviewer for quality and security reviews.",
                prompt="Analyze code quality and suggest improvements.",
                tools=["Read", "Glob", "Grep"],
            )
        },
    ),
):
    ...
```

> SDK에서 서브에이전트를 사용하려면 `allowedTools`에 `"Agent"`를 반드시 포함해야 함.

**SDK 세션 재개:**

```python
from claude_agent_sdk import query, ClaudeAgentOptions, SystemMessage

session_id = None

# 첫 번째 쿼리에서 세션 ID 캡처
async for message in query(
    prompt="Read the authentication module",
    options=ClaudeAgentOptions(allowed_tools=["Read", "Glob"]),
):
    if isinstance(message, SystemMessage) and message.subtype == "init":
        session_id = message.data["session_id"]

# 전체 컨텍스트를 유지한 채 재개
async for message in query(
    prompt="Now find all places that call it",
    options=ClaudeAgentOptions(resume=session_id),
):
    ...
```

**Agent SDK vs CLI vs Managed Agents:**

| | Agent SDK | CLI (`claude -p`) | Managed Agents |
|---|---|---|---|
| 실행 위치 | 사용자 프로세스 | 로컬 머신 | Anthropic 인프라 |
| 인터페이스 | Python/TypeScript 라이브러리 | CLI | REST API |
| 세션 상태 | 로컬 JSONL | 로컬 파일 | Anthropic 호스팅 이벤트 로그 |
| 적합 용도 | CI/CD, 자동화, 커스텀 앱 | 대화형 개발, 단발 작업 | 프로덕션 장기 실행 태스크 |

> SDK 크레딧 주의: 2026-06-15부터 구독 플랜에서 `claude -p`와 Agent SDK 사용은 별도 월간 크레딧에서 차감됨.

---

### 13. 서브에이전트 컨텍스트 트랜스크립트

- 서브에이전트 트랜스크립트는 메인 대화와 독립적으로 저장됨
- 위치: `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`
- 메인 대화 `/compact` 시 서브에이전트 트랜스크립트는 영향받지 않음
- 자동 정리: `cleanupPeriodDays` 설정 기준 (기본 30일)
- 서브에이전트 자동 컴팩션: 약 95% 용량 시 트리거 (환경변수 `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`로 조정)

---

## 버전별 차이

| 기능 | 버전 | 내용 |
|---|---|---|
| 서브에이전트 기본 지원 | v2.1.0+ | `Task` 도구로 서브에이전트 생성 |
| Task → Agent 도구 이름 변경 | v2.1.63 | `Task(...)` 구문은 하위 호환 alias로 여전히 동작 |
| Fork 서브에이전트 | v2.1.117+ | `CLAUDE_CODE_FORK_SUBAGENT=1` 환경변수 필요, 실험적 |
| `SubagentStart` / `SubagentStop` 훅 이벤트 | v2.1.x | settings.json에서 서브에이전트 라이프사이클 훅 정의 가능 |
| Agent SDK (Python/TypeScript) | 별도 패키지 | `claude-agent-sdk` / `@anthropic-ai/claude-agent-sdk` |

---

## 자주 하는 실수

1. **`Agent` 도구를 `allowedTools`에 빠뜨림** — SDK나 에이전트 파일에서 서브에이전트를 쓰려면 `allowedTools`에 `"Agent"`를 반드시 포함해야 한다.

2. **서브에이전트 안에서 또 서브에이전트를 생성하려 함** — 중첩 서브에이전트는 지원하지 않는다. 워크플로우를 메인 대화에서 체인으로 구성하거나 Skills를 활용한다.

3. **`description`이 모호하거나 짧음** — Claude는 description을 보고 위임 시점을 결정한다. "Use proactively after code changes"처럼 구체적으로 작성해야 자동 위임이 잘 된다.

4. **파일 직접 수정 후 재시작 없이 기대** — 서브에이전트 파일을 디스크에서 직접 편집하면 세션을 재시작해야 반영된다. `/agents` UI로 만든 경우엔 즉시 반영.

5. **부모의 `bypassPermissions`를 서브에이전트에서 낮추려 함** — 부모가 `bypassPermissions` 또는 `acceptEdits`이면 서브에이전트 `permissionMode`로 오버라이드 불가.

6. **병렬 서브에이전트 결과가 컨텍스트를 소모한다는 것을 모름** — 여러 서브에이전트가 각각 상세 결과를 반환하면 메인 컨텍스트가 빠르게 소모된다. 결과를 요약해 반환하도록 프롬프트를 설계한다.

7. **플러그인 서브에이전트에 `hooks`·`mcpServers`·`permissionMode`를 설정** — 플러그인 서브에이전트는 이 세 필드를 무시한다. 필요하면 `.claude/agents/`에 파일을 복사해 사용한다.

8. **`disable-model-invocation: true` 스킬을 `skills` 필드에 나열** — 이 스킬은 preload 불가. 해당 스킬은 사용자가 `/skill-name`으로 직접 호출해야 한다.

---

## 참고

- 서브에이전트 공식 문서: https://code.claude.com/docs/en/sub-agents
- Agent SDK 개요: https://code.claude.com/docs/en/agent-sdk/overview
- 권한 모드: https://code.claude.com/docs/en/permission-modes
- 훅 레퍼런스: https://code.claude.com/docs/en/hooks
- 관련 챕터: `chapters/01-concepts.md`, `chapters/06-hooks.md`

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/ryujaeuk/cc-gnothi</sub>
