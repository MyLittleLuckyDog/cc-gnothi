---
type: chapter
chapter: "10"
title: "실전 워크플로우 패턴"
cc_version_min: "2.1.0"
updated: 2026-05-17
tags: ["workflows", "patterns", "bug-fix", "pr", "testing", "ci", "parallel", "worktree", "context", "plan-mode", "init", "CLAUDE.md", "headless", "subagent"]
related:
  - chapters/01-concepts.md
  - chapters/02-config.md
  - chapters/03-commands.md
  - chapters/06-hooks.md
  - chapters/08-ci.md
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
---

# 실전 워크플로우 패턴

> 이 챕터: CC를 일상 개발에 적용하는 8가지 검증된 패턴.  
> 최소 버전: v2.1.0

## 개념

CC는 질문에 답하는 챗봇이 아니라 **파일을 읽고, 명령을 실행하고, 변경을 반복하는 에이전틱 루프**다. 이 특성으로 인해 일반 LLM 사용 패턴과 다른 전략이 필요하다.

가장 중요한 제약: **컨텍스트 창이 빠르게 찬다.** 하나의 디버깅 세션이나 코드베이스 탐색으로 수만 토큰을 소비할 수 있고, 창이 차면 성능이 저하된다. 이 챕터의 모든 패턴은 이 제약을 중심으로 설계되어 있다.

---

## 패턴

### 1. 새 코드베이스 파악 — `/init` → CLAUDE.md → 구조 이해

**목적**: 합류한 프로젝트를 최단 시간에 파악하고, 다음 세션부터 CC가 자동으로 맥락을 갖추도록 한다.

| 단계 | 명령 | 설명 |
|---|---|---|
| 1 | `cd /path/to/project && claude` | 프로젝트 루트에서 CC 실행 |
| 2 | `/init` | 빌드 시스템·테스트 프레임워크·코드 패턴 분석 → `CLAUDE.md` 초안 생성 |
| 3 | `give me an overview of this codebase` | 전체 구조 파악 |
| 4 | `explain the main architecture patterns used here` | 아키텍처 패턴 |
| 5 | `what are the key data models?` / `how is authentication handled?` | 세부 탐색 |
| 6 | `CLAUDE.md` 검토·정제 | 자동 생성 초안을 팀 실정에 맞게 다듬어 커밋 |

**CLAUDE.md에 포함할 것 vs 제외할 것**:

| 포함 | 제외 |
|---|---|
| CC가 추측 불가한 bash 명령 | 코드를 읽으면 알 수 있는 내용 |
| 기본값과 다른 코드 스타일 규칙 | CC가 이미 아는 언어 표준 관례 |
| 테스트 실행 방법 | 자주 바뀌는 정보 |
| 브랜치 명명·PR 컨벤션 | "클린 코드를 써라" 같은 자명한 지침 |
| 프로젝트 특유의 아키텍처 결정 | 파일별 코드베이스 설명 |

> `CLAUDE.md`가 너무 길면 CC가 규칙 일부를 무시한다. 한 줄씩 "이게 없으면 CC가 실수하는가?"를 확인해 정리한다.

---

### 2. 버그 수정 — 증상 → 재현 → 수정 → 검증

**목적**: 에러 원인을 최소한의 변경으로 수정하고, 수정 여부를 자동 검증한다.

| 단계 | 프롬프트 예시 |
|---|---|
| 1. 증상 공유 | `I'm seeing an error when I run npm test` |
| 2. 재현 명령 제공 | 스택 트레이스 전체 붙여넣기 + `the error is consistent / intermittent` |
| 3. 수정 방향 제안 요청 | `suggest a few ways to fix the @ts-ignore in user.ts` |
| 4. 수정 적용 | `update user.ts to add the null check you suggested` |
| 5. 검증 | `run the tests and confirm the error is gone` |

**검증 기준을 명시하는 것이 가장 높은 레버리지**:

```
# Bad
fix the login bug

# Good
users report login fails after session timeout. check src/auth/, especially token refresh.
write a failing test that reproduces the issue, then fix it.
fix the root cause — don't suppress the error.
```

---

### 3. 기능 추가 — Explore → Plan → Implement → Commit

**목적**: 잘못된 문제를 해결하거나 파일을 무작위로 수정하는 것을 방지한다.

| 단계 | 모드 | 행동 |
|---|---|---|
| 1. Explore | Plan mode | `read /src/auth and understand how we handle sessions and login` |
| 2. Plan | Plan mode | `I want to add Google OAuth. What files need to change? Create a plan.` |
| 2a. 플랜 편집 | — | `Ctrl+G` → 에디터에서 플랜 직접 수정 |
| 3. Implement | Default mode | `implement the OAuth flow from your plan. write tests, run them, fix failures` |
| 4. Commit | Default mode | `commit with a descriptive message and open a PR` |

**Plan mode 진입 방법**:

```bash
# 시작 시
claude --permission-mode plan

# 세션 중 토글
Shift+Tab
```

> Plan mode는 파일 읽기만 허용하고 편집을 차단한다. 변경 범위가 크거나 코드가 낯선 경우에만 쓴다. 한 문장으로 diff를 설명할 수 있다면 플랜 없이 진행한다.

---

### 4. PR/커밋 패턴 — 변경 요약 → 커밋 메시지 → PR 생성

**목적**: 변경 사항을 팀이 이해하기 쉬운 PR로 정리한다.

| 단계 | 프롬프트 |
|---|---|
| 1. 변경 요약 | `summarize the changes I've made to the authentication module` |
| 2. PR 생성 | `create a pr` |
| 3. 설명 보강 | `enhance the PR description with more context about the security improvements` |
| 4. 리스크 검토 | `highlight potential risks or considerations before I submit` |

**세션-PR 연결**:

```bash
# PR 생성 후 나중에 돌아오기
claude --from-pr 1234
# 또는 /resume에서 PR URL로 검색
```

`gh pr create`로 생성된 PR은 해당 세션과 자동 연결된다.

---

### 5. 테스트 작성 — 미커버 식별 → 스캐폴딩 → 엣지케이스 → 실행

**목적**: 기존 테스트 스타일을 유지하면서 의미 있는 테스트를 추가한다.

| 단계 | 프롬프트 예시 |
|---|---|
| 1. 미커버 코드 식별 | `find functions in NotificationsService.swift that are not covered by tests` |
| 2. 테스트 스캐폴딩 | `add tests for the notification service` |
| 3. 엣지케이스 추가 | `add test cases for edge conditions in the notification service` |
| 4. 실행·수정 | `run the new tests and fix any failures` |

**TDD 흐름에서 CC 활용**:

```
# Writer/Tester 패턴 (두 세션)
세션 A: write tests for the rate limiter
세션 B: implement code to pass the tests in @src/middleware/rateLimiter.test.ts
```

CC는 기존 테스트 파일의 스타일·프레임워크·어서션 패턴을 자동으로 맞춘다. 검증하려는 동작을 구체적으로 명시할수록 결과가 좋아진다.

---

### 6. CI 연동 — `--bare -p` 조합, 파이프, 배치

**목적**: CC를 CI 파이프라인·pre-commit hook·배치 처리에 통합한다.

**`--bare` 사용 이유**: CI 머신에는 로컬 hooks·MCP·`CLAUDE.md` 자동 탐색이 없다. `--bare`로 이 탐색을 명시적으로 스킵하면 예측 가능한 동작을 보장한다.

```bash
# 단순 파이프
git log --oneline -20 | claude -p "summarize these recent commits"

# JSON 출력 (스크립트 파싱용)
claude -p "List all API endpoints" --output-format json

# 스트리밍 JSON (실시간 처리)
claude -p "Analyze this log file" --output-format stream-json

# CI 권장 조합
claude --bare -p "run the test suite and report failures" \
  --allowedTools "Bash(npm run test *),Read"

# 대규모 파일 마이그레이션 (배치)
for file in $(cat files.txt); do
  claude -p "Migrate $file from React to Vue. Return OK or FAIL." \
    --allowedTools "Edit,Bash(git commit *)"
done
```

**CI에서 자동 승인이 필요한 경우**:

```bash
# auto mode — 분류기가 위험 명령만 차단
claude --permission-mode auto -p "fix all lint errors"
```

GitHub Actions 연동은 `/en/github-actions` 참고.

---

### 7. 병렬 세션 — git worktree, Writer/Reviewer 패턴

**목적**: 서로 충돌 없이 두 가지 이상의 작업을 동시에 진행한다.

**Worktree 기반 병렬 실행**:

```bash
# 터미널 1 — 기능 개발
claude --worktree feature-auth

# 터미널 2 — 버그 수정 (독립 브랜치 체크아웃)
claude --worktree bugfix-payment
```

각 worktree는 독립된 브랜치 체크아웃이므로 파일 충돌이 없다.

**Writer/Reviewer 패턴 (코드 리뷰 품질 향상)**:

| 세션 A (Writer) | 세션 B (Reviewer) |
|---|---|
| `Implement a rate limiter for our API endpoints` | — |
| — | `Review @src/middleware/rateLimiter.ts. Look for edge cases, race conditions, and consistency with existing middleware.` |
| `[리뷰 피드백] Address these issues.` | — |

> Reviewer 세션은 구현 세션과 컨텍스트를 공유하지 않으므로 편향 없이 검토한다.

---

### 8. 컨텍스트 관리 — `/compact`, `/clear`, 세션 재개

**목적**: 긴 세션에서 컨텍스트 오염을 방지하고 작업을 여러 세션에 걸쳐 이어간다.

**컨텍스트 관리 도구**:

| 상황 | 명령 | 효과 |
|---|---|---|
| 무관한 작업으로 전환 | `/clear` | 컨텍스트 창 전체 초기화 |
| 컨텍스트를 유지하되 압축 | `/compact` | CC가 핵심 코드·결정만 남기고 요약 |
| 특정 정보 보존하며 압축 | `/compact Focus on the API changes` | 지정 맥락만 살려서 압축 |
| 대화 일부 되감기 | `Esc+Esc` 또는 `/rewind` | 이전 체크포인트로 복원 |
| 기록에 남기지 않는 빠른 질문 | `/btw <질문>` | 오버레이로 답변, 히스토리 미기록 |
| 탐색으로 컨텍스트 오염 방지 | `use a subagent to investigate X` | 서브에이전트가 별도 창에서 탐색 후 요약 보고 |

**세션 재개**:

```bash
# 가장 최근 세션 재개
claude --continue

# 목록에서 선택
claude --resume

# 세션 중 재개
/resume
```

> 세션에 `/rename oauth-migration` 같은 이름을 붙이면 나중에 찾기 쉽다. 세션은 로컬에 영구 저장된다.

**컨텍스트 관리 우선순위**:

```
같은 문제를 두 번 이상 수정 중 → /clear 후 더 구체적인 초기 프롬프트로 재시작
코드베이스 대규모 탐색 → 서브에이전트 위임
빠른 단순 질문 → /btw 사용
```

---

## 버전별 차이

| 기능 | v2.0.x | v2.1.x |
|---|---|---|
| `--bare` 모드 | 미지원 | 지원 (CI 권장) |
| `--worktree <name>` | 미지원 | 지원 |
| `--from-pr <number>` | 미지원 | 지원 |
| `/compact <instructions>` | 미지원 | 지원 |
| `/btw` | 미지원 | 지원 |
| `/rewind` | 미지원 | 지원 |
| Auto memory (`MEMORY.md`) | 미지원 | v2.1.59+ |
| `--permission-mode auto` | 미지원 | 지원 |
| `Ctrl+G` (플랜 에디터 편집) | 미지원 | 지원 |

---

## 자주 하는 실수

1. **`--bare` 없이 CI에서 `claude -p` 사용** — 로컬 hooks·MCP가 CI 머신에 없으면 예측 불가 동작. `claude --bare -p "..."` 사용.

2. **검증 기준 없이 구현 요청** — CC가 그럴듯해 보이지만 엣지케이스를 처리하지 않는 코드를 반환. 항상 테스트·스크립트·스크린샷으로 검증 조건을 명시.

3. **잡탕 세션** — 무관한 작업이 같은 컨텍스트에 쌓임. 작업 전환 시 `/clear`.

4. **같은 오류를 두 번 이상 수정** — 두 번 실패 후에도 같은 세션에서 재시도. `/clear` 후 더 구체적인 초기 프롬프트로 재시작.

5. **비대한 CLAUDE.md** — 규칙이 너무 많아 CC가 일부를 무시. 각 줄마다 "이게 없으면 CC가 실수하는가?" 확인 후 정리. 200줄 초과 시 `.claude/rules/`로 분산 권장.

6. **무한 탐색** — 탐색 범위를 좁히지 않아 CC가 수백 개 파일을 읽고 컨텍스트 소진. 탐색은 서브에이전트에 위임하거나 `@path/to/file`로 파일을 직접 지목.

7. **`--permission-mode plan`에서 승인 없이 구현 기대** — Plan mode에서 CC는 편집을 하지 않는다. 승인 후 `Shift+Tab`으로 모드 전환 필요.

8. **세션 간 컨텍스트 공유를 가정** — 각 세션은 독립. 지속 정보는 `CLAUDE.md` 또는 Auto memory(`MEMORY.md`)에.

---

## 참고

- 공통 워크플로우: https://code.claude.com/docs/en/common-workflows
- 베스트 프랙티스: https://code.claude.com/docs/en/best-practices
- Non-interactive 모드: https://code.claude.com/docs/en/headless
- Plan mode: https://code.claude.com/docs/en/permission-modes
- Worktrees: https://code.claude.com/docs/en/worktrees
- 세션 관리: https://code.claude.com/docs/en/sessions
- Subagents: https://code.claude.com/docs/en/sub-agents
- GitHub Actions: https://code.claude.com/docs/en/github-actions
- 관련 챕터: `chapters/01-concepts.md`

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/ryujaeuk/cc-gnothi</sub>
