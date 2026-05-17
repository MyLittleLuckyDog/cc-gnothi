---
type: reference
title: "Claude Code CLI 플래그 전체 레퍼런스"
cc_version_min: "2.1.0"
updated: 2026-05-17
tags: ["cli", "flags", "reference", "headless", "print-mode", "permissions"]
token_budget: 2000
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
source: https://code.claude.com/docs/en/cli-reference
stale_risk: high
---

# Claude Code CLI 플래그 전체 레퍼런스

> 출처: https://code.claude.com/docs/en/cli-reference (2026-05-17 fetch)  
> `claude --help`에 없는 플래그도 유효하다. 부재 = 사용 불가가 아님.  
> `[p]` 표시: `--print` (`-p`) **print mode 전용** 플래그.

---

## 1. 세션 / 실행 모드

| 플래그 | 단축 | 타입 | 설명 | 예시 |
|--------|------|------|------|------|
| `--continue` | `-c` | bool | 현재 디렉토리의 가장 최근 대화 로드 | `claude -c` |
| `--resume` | `-r` | string | ID 또는 이름으로 세션 재개. 생략 시 인터랙티브 선택기 표시 | `claude -r auth-refactor` |
| `--fork-session` | — | bool | 재개 시 원본을 재사용하지 않고 새 세션 ID 생성. `--resume`/`--continue`와 함께 사용 | `claude -r abc123 --fork-session` |
| `--from-pr` | — | string | PR에 연결된 세션 재개. PR 번호, GitHub/GitLab/Bitbucket URL 수락 | `claude --from-pr 123` |
| `--session-id` | — | UUID | 대화에 사용할 세션 ID 직접 지정 | `claude --session-id 550e8400-...` |
| `--name` | `-n` | string | 세션 표시 이름 설정. `/resume`과 터미널 제목에 표시 | `claude -n "feature-work"` |
| `--print` | `-p` | bool | 인터랙티브 모드 없이 응답 출력 후 종료 (headless / SDK 모드) | `claude -p "query"` |
| `--bg` | — | bool | 백그라운드 에이전트로 세션 시작 후 즉시 반환. 세션 ID 출력 | `claude --bg "fix flaky test"` |
| `--remote` | — | string | claude.ai에 새 웹 세션 생성 | `claude --remote "Fix login bug"` |
| `--teleport` | — | bool | 웹 세션을 로컬 터미널로 재개 | `claude --teleport` |
| `--bare` | — | bool | 최소 모드: hooks·skills·plugins·MCP·auto memory·CLAUDE.md 자동 탐색 스킵. `CLAUDE_CODE_SIMPLE` 설정 | `claude --bare -p "query"` |
| `--worktree` | `-w` | string | 격리된 git worktree에서 Claude 시작. `#<번호>` 또는 PR URL로 해당 PR 체크아웃 가능 | `claude -w feature-auth` |
| `--tmux` | — | string | worktree에 tmux 세션 생성. `--worktree` 필수. `--tmux=classic`으로 전통 tmux | `claude -w feat --tmux` |
| `--max-turns` `[p]` | — | int | 에이전트 턴 수 제한. 한도 초과 시 오류 종료. 기본값: 무제한 | `claude -p --max-turns 3 "query"` |
| `--max-budget-usd` `[p]` | — | float | API 호출 최대 지출액(달러). 한도 초과 시 중단 | `claude -p --max-budget-usd 5.00 "query"` |
| `--init` `[p]` | — | bool | 세션 전 `init` 매처로 Setup 훅 실행 | `claude -p --init "query"` |
| `--maintenance` `[p]` | — | bool | 세션 전 `maintenance` 매처로 Setup 훅 실행 | `claude -p --maintenance "query"` |
| `--init-only` | — | bool | Setup·SessionStart 훅 실행 후 대화 시작 없이 종료 | `claude --init-only` |
| `--ide` | — | bool | 유효한 IDE가 정확히 하나일 때 시작 시 자동 연결 | `claude --ide` |
| `--chrome` | — | bool | Chrome 브라우저 통합 활성화 | `claude --chrome` |
| `--no-chrome` | — | bool | 이 세션에서 Chrome 통합 비활성화 | `claude --no-chrome` |

---

## 2. 출력 제어

| 플래그 | 단축 | 타입/값 | 설명 | 예시 |
|--------|------|---------|------|------|
| `--output-format` `[p]` | — | `text` \| `json` \| `stream-json` | print mode 출력 형식 지정 | `claude -p "query" --output-format json` |
| `--input-format` `[p]` | — | `text` \| `stream-json` | print mode 입력 형식 지정 | `claude -p --input-format stream-json` |
| `--include-hook-events` `[p]` | — | bool | 출력 스트림에 모든 훅 이벤트 포함. `--output-format stream-json` 필수 | `claude -p --output-format stream-json --include-hook-events "query"` |
| `--include-partial-messages` `[p]` | — | bool | 부분 스트리밍 이벤트 포함. `--print`·`--output-format stream-json` 필수 | `claude -p --output-format stream-json --include-partial-messages "query"` |
| `--replay-user-messages` `[p]` | — | bool | stdin의 유저 메시지를 stdout으로 재방출(확인용). `--input-format stream-json`·`--output-format stream-json` 필수 | `claude -p --input-format stream-json --output-format stream-json --replay-user-messages` |
| `--json-schema` `[p]` | — | JSON string | 에이전트 완료 후 JSON Schema에 맞는 검증된 JSON 출력 | `claude -p --json-schema '{"type":"object"}' "query"` |
| `--no-session-persistence` `[p]` | — | bool | 세션을 디스크에 저장하지 않음. `CLAUDE_CODE_SKIP_PROMPT_HISTORY` 환경 변수와 동일 | `claude -p --no-session-persistence "query"` |
| `--verbose` | — | bool | 상세 로깅 활성화, 턴별 전체 출력 표시. `viewMode` 설정 재정의 | `claude --verbose` |
| `--debug` | — | string | 디버그 모드 활성화. 카테고리 필터 지원 (`"api,mcp"`, `"!statsig,!file"`) | `claude --debug "api,mcp"` |
| `--debug-file <path>` | — | path | 특정 파일에 디버그 로그 기록. 암묵적으로 debug mode 활성화 | `claude --debug-file /tmp/debug.log` |
| `--fallback-model` `[p]` | — | string | 기본 모델 과부하 시 자동 대체 모델 지정 | `claude -p --fallback-model sonnet "query"` |
| `--exclude-dynamic-system-prompt-sections` | — | bool | 머신별 시스템 프롬프트 섹션을 첫 번째 유저 메시지로 이동. 프롬프트 캐시 재사용 향상. 기본 시스템 프롬프트에서만 동작 | `claude -p --exclude-dynamic-system-prompt-sections "query"` |

---

## 3. 도구 · 권한

| 플래그 | 단축 | 타입/값 | 설명 | 예시 |
|--------|------|---------|------|------|
| `--permission-mode` | — | `default` \| `acceptEdits` \| `plan` \| `auto` \| `dontAsk` \| `bypassPermissions` | 시작 권한 모드. 설정 파일의 `defaultMode` 재정의 | `claude --permission-mode plan` |
| `--dangerously-skip-permissions` | — | bool | 권한 프롬프트 전체 생략. `--permission-mode bypassPermissions`와 동일 | `claude --dangerously-skip-permissions` |
| `--allow-dangerously-skip-permissions` | — | bool | `bypassPermissions`를 Shift+Tab 사이클에 추가(시작 모드로 설정하지 않음). 다른 모드에서 시작 후 나중에 전환 가능 | `claude --permission-mode plan --allow-dangerously-skip-permissions` |
| `--allowedTools` | — | string... | 권한 확인 없이 실행할 도구 패턴. 도구 제한이 목적이면 `--tools` 사용 | `--allowedTools "Bash(git log *)" "Read"` |
| `--disallowedTools` | — | string... | 모델 컨텍스트에서 제거하여 사용 불가하게 할 도구 | `--disallowedTools "Bash(git log *)" "Edit"` |
| `--tools` | — | string | Claude가 사용할 내장 도구 제한. `""` 전체 비활성화, `"default"` 전체 허용 | `claude --tools "Bash,Edit,Read"` |
| `--permission-prompt-tool` `[p]` | — | string | 비대화형 모드에서 권한 프롬프트를 처리할 MCP 도구 지정 | `claude -p --permission-prompt-tool mcp_auth_tool "query"` |
| `--add-dir` | — | path... | 추가 작업 디렉토리 지정. 파일 접근 권한 부여. 해당 디렉토리의 `.claude/` 설정은 자동 탐색되지 않음 | `claude --add-dir ../apps ../lib` |
| `--disable-slash-commands` | — | bool | 이 세션의 모든 스킬과 슬래시 커맨드 비활성화 | `claude --disable-slash-commands -p "query"` |

---

## 4. 모델 · 설정

| 플래그 | 단축 | 타입/값 | 설명 | 예시 |
|--------|------|---------|------|------|
| `--model` | — | string | 세션 모델 설정. `sonnet`·`opus` 별칭 또는 전체 모델명. `ANTHROPIC_MODEL` 재정의 | `claude --model claude-sonnet-4-6` |
| `--effort` | — | `low` \| `medium` \| `high` \| `xhigh` \| `max` | 세션 effort 레벨. 지원 모델에 한함. `effortLevel` 설정 재정의(비영구) | `claude --effort high` |
| `--betas` | — | string... | API 요청에 포함할 베타 헤더. API 키 사용자 전용 | `claude --betas interleaved-thinking` |
| `--settings` | — | path \| JSON | 설정 JSON 파일 경로 또는 인라인 JSON 문자열. 이 세션의 `settings.json` 값 재정의 | `claude --settings ./settings.json` |
| `--setting-sources` | — | string | 로드할 설정 소스 쉼표 구분 지정 (`user`, `project`, `local`) | `claude --setting-sources user,project` |
| `--mcp-config` | — | path \| JSON | JSON 파일이나 문자열에서 MCP 서버 로드 (공백 구분 복수 가능) | `claude --mcp-config ./mcp.json` |
| `--strict-mcp-config` | — | bool | `--mcp-config`의 MCP 서버만 사용하고 다른 MCP 구성 무시 | `claude --strict-mcp-config --mcp-config ./mcp.json` |
| `--channels` | — | string... | 이 세션에서 수신할 MCP 채널. `plugin:<name>@<marketplace>` 형식. Claude.ai 인증 필요 | `claude --channels plugin:my-notifier@my-marketplace` |
| `--dangerously-load-development-channels` | — | string... | 허용 목록에 없는 채널 활성화(로컬 개발용). 확인 프롬프트 표시 | `claude --dangerously-load-development-channels server:webhook` |
| `--teammate-mode` | — | `auto` \| `in-process` \| `tmux` | 팀메이트 표시 방식. `teammateMode` 설정 재정의 | `claude --teammate-mode in-process` |
| `--agent` | — | string | 현재 세션에서 사용할 에이전트 지정 (`agent` 설정 재정의) | `claude --agent my-custom-agent` |
| `--agents` | — | JSON string | JSON으로 커스텀 서브에이전트를 동적으로 정의. frontmatter 필드 + `prompt` 필드 | `claude --agents '{"reviewer":{"prompt":"..."}}` |
| `--plugin-dir` | — | path | 디렉토리 또는 `.zip`에서 플러그인 로드 (이 세션 한정). 복수: 플래그 반복 | `claude --plugin-dir ./my-plugin` |
| `--plugin-url` | — | URL | URL에서 플러그인 `.zip` 아카이브 가져오기 (이 세션 한정) | `claude --plugin-url https://example.com/plugin.zip` |
| `--version` | `-v` | bool | 버전 번호 출력 | `claude -v` |

---

## 5. 시스템 프롬프트

| 플래그 | 동작 | 예시 |
|--------|------|------|
| `--system-prompt` | 기본 시스템 프롬프트 전체를 인라인 텍스트로 교체 | `claude --system-prompt "You are a Python expert"` |
| `--system-prompt-file` | 파일 내용으로 기본 프롬프트 교체 | `claude --system-prompt-file ./custom-prompt.txt` |
| `--append-system-prompt` | 인라인 텍스트를 기본 프롬프트 끝에 추가 | `claude --append-system-prompt "Always use TypeScript"` |
| `--append-system-prompt-file` | 파일 내용을 기본 프롬프트 끝에 추가 | `claude --append-system-prompt-file ./extra-rules.txt` |

**규칙:**
- `--system-prompt`와 `--system-prompt-file`은 상호 배타적
- append 플래그는 교체 플래그와 조합 가능
- 교체: 기본 도구 안내·안전 지침 포함 전체 프롬프트 삭제 → 비코딩 파이프라인에 적합
- 추가: 기본 프롬프트 보존 + 추가 규칙 → 코딩 어시스턴트 정체성 유지 시 권장

---

## 6. Remote Control

| 플래그 | 단축 | 설명 | 예시 |
|--------|------|------|------|
| `--remote-control` | `--rc` | Remote Control 활성화된 인터랙티브 세션 시작. claude.ai/앱에서 제어 가능 | `claude --remote-control "My Project"` |
| `--remote-control-session-name-prefix <prefix>` | — | Remote Control 세션 이름 자동 생성 시 접두사. 기본값: 호스트명 → `myhost-graceful-unicorn` | `claude remote-control --remote-control-session-name-prefix dev-box` |

---

## 7. 제거된 플래그

| 플래그 | 제거 버전 | 대체 |
|--------|-----------|------|
| `--enable-auto-mode` | v2.1.111 | `--permission-mode auto` (auto mode는 Shift+Tab 사이클에 기본 포함) |

---

## 자주 조합되는 패턴

### CI / 자동화

```bash
# 최소 환경, 허용 도구 제한, 비대화형
claude --bare -p "Run tests and fix failures" \
  --allowedTools "Bash(npm test *)" "Read" "Edit"

# 최대 지출 제한 + 턴 제한
claude -p --max-budget-usd 2.00 --max-turns 10 "Summarize changes"

# 세션 저장 안 함 (임시 파이프라인)
claude -p --no-session-persistence "query"
```

### 파이프 / stdin 처리

```bash
# 파일 내용 파이프
cat logs.txt | claude -p "Summarize errors"

# git diff 파이프
git diff main | claude -p "Review for security issues"

# JSON 출력으로 파싱 가능하게
git diff main | claude -p --output-format json "List changed functions"
```

### 스트리밍 JSON (SDK 통합)

```bash
# stream-json 출력
claude -p --output-format stream-json "query"

# 훅 이벤트 포함 (--output-format stream-json 필수)
claude -p --output-format stream-json --include-hook-events "query"

# 부분 메시지 포함 (--print + stream-json 필수)
claude -p --output-format stream-json --include-partial-messages "query"

# 유저 메시지 재방출 (input/output 모두 stream-json 필수)
claude -p --input-format stream-json --output-format stream-json \
  --replay-user-messages
```

### 프롬프트 캐시 최적화 (멀티유저 파이프라인)

```bash
# 머신별 섹션을 시스템 프롬프트에서 제외 → 캐시 히트율 향상
claude -p --exclude-dynamic-system-prompt-sections \
  --append-system-prompt "Output JSON only" "query"
```

### 플랜 모드로 시작, 필요 시 bypass 전환

```bash
# plan 모드로 시작 + 나중에 Shift+Tab으로 bypassPermissions 전환 가능
claude --permission-mode plan --allow-dangerously-skip-permissions
```

### MCP 전용 환경 (다른 MCP 구성 무시)

```bash
# 지정한 mcp.json의 서버만 사용
claude --strict-mcp-config --mcp-config ./pipeline-mcp.json -p "query"
```

### worktree + tmux 격리

```bash
# git worktree 격리 + tmux 세션
claude -w feature-auth --tmux

# PR에서 worktree 생성
claude -w "#42" --tmux
```

### 세션 재개 패턴

```bash
# 이름으로 재개
claude -r "auth-refactor"

# 재개하되 새 세션 ID로 분기
claude -r "auth-refactor" --fork-session

# PR에 연결된 세션 재개
claude --from-pr 42
```

---

## 참고

- 공식 CLI 레퍼런스: https://code.claude.com/docs/en/cli-reference
- Headless 모드: https://code.claude.com/docs/en/headless
- 권한 모드: https://code.claude.com/docs/en/permission-modes
- Agent SDK: https://code.claude.com/docs/en/agent-sdk/overview
- 설정: https://code.claude.com/docs/en/settings
- 환경 변수: https://code.claude.com/docs/en/env-vars
- 관련 파일: `docs/anthropic-docs/cc-cli-reference.md`

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/MyLittleLuckyDog/cc-gnothi</sub>
