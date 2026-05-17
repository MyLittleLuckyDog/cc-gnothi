---
type: chapter
chapter: "06"
title: "Hooks — 이벤트 기반 자동화"
cc_version_min: "2.1.0"
updated: 2026-05-17
tags: ["hooks", "automation", "events", "settings", "PreToolUse", "PostToolUse", "Stop", "Notification", "SubagentStop", "exit-code", "formatting", "lint"]
related:
  - chapters/01-concepts.md
  - chapters/02-config.md
  - chapters/04-mcp.md
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
---

# Hooks — 이벤트 기반 자동화

> 이 챕터: CC 라이프사이클 이벤트에 셸 명령·HTTP 요청·LLM 판단을 바인딩하는 메커니즘.  
> 최소 버전: v2.1.0

## 개념

Hooks는 **CC 이벤트에 핸들러를 바인딩하는 자동화 메커니즘**이다. Claude의 결정과 무관하게 확정적으로 실행된다.

핵심 특성:

| 속성 | 설명 |
|------|------|
| 결정론적 | Claude가 선택하는 것이 아님 — 이벤트 발생 시 항상 실행 |
| 차단 가능 | 종료 코드 `2`로 툴 호출·프롬프트·컴팩션 등을 블로킹 |
| stdin 수신 | 이벤트 컨텍스트가 JSON으로 stdin에 주입됨 |
| stdout 활용 | JSON 구조로 CC에 결정·컨텍스트·알림을 돌려줄 수 있음 |

---

## 패턴

### 1. 주요 이벤트 종류

전체 이벤트 중 실무에서 가장 많이 쓰는 5가지:

| 이벤트 | 발생 시점 | 블로킹 | matcher 대상 |
|--------|-----------|--------|--------------|
| `PreToolUse` | 툴 호출 직전 | Yes | 툴 이름 (`Bash`, `Edit`, `mcp__.*`) |
| `PostToolUse` | 툴 호출 성공 후 | No | 툴 이름 |
| `Stop` | Claude가 응답 완료 | Yes (exit 2) | 없음 (항상 발동) |
| `Notification` | CC가 알림 전송 | No | 알림 유형 |
| `SubagentStop` | 서브에이전트 종료 | Yes (exit 2) | 에이전트 타입 |

그 외 이벤트: `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PermissionRequest`, `PreCompact`, `FileChanged` 등 30여 종. 공식 문서 참고.

---

### 2. 종료 코드 의미

| 코드 | 의미 | 동작 |
|------|------|------|
| `0` | 성공 | stdout의 JSON을 파싱해 처리 |
| `2` | 블로킹 오류 | stderr를 Claude/사용자에게 전달하고 액션 차단 |
| 그 외 (1 포함) | 비블로킹 오류 | stderr를 트랜스크립트에 표시, 실행 계속 |

> **중요**: `exit 1`은 비블로킹이다. 툴 호출을 막으려면 반드시 `exit 2`를 사용해야 한다.

이벤트별 `exit 2`의 실제 효과:

| 이벤트 | exit 2 효과 |
|--------|-------------|
| `PreToolUse` | 툴 호출 차단 |
| `Stop` | 중단 방지, 대화 계속 진행 |
| `UserPromptSubmit` | 프롬프트 차단 및 컨텍스트에서 삭제 |
| `PreCompact` | 컴팩션 차단 |
| `SubagentStop` | 서브에이전트 종료 방지 |
| `PostToolUse` | 차단 없음 (툴이 이미 실행됨) |
| `Notification` | 차단 없음 |

---

### 3. settings.json 설정 구조

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolName|ToolName2",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/script.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**설정 파일 위치**:

| 파일 | 범위 |
|------|------|
| `~/.claude/settings.json` | 사용자 전체 프로젝트 |
| `.claude/settings.json` | 프로젝트 (팀 공유, 버전 관리) |
| `.claude/settings.local.json` | 프로젝트 로컬 (개인, gitignore) |

**matcher 구문**:

| 패턴 | 해석 방식 | 예시 |
|------|-----------|------|
| 빈 문자열 / 생략 | 전체 매칭 | 항상 발동 |
| 영숫자·`_`·`\|`만 | 정확한 문자열 또는 `\|` 구분 목록 | `Bash` / `Edit\|Write` |
| 그 외 특수문자 포함 | JavaScript 정규식 | `mcp__memory__.*` |

**훅 타입**:

| 타입 | 설명 |
|------|------|
| `command` | 셸 명령 실행 (stdin으로 JSON 수신) |
| `http` | POST 요청 전송 |
| `mcp_tool` | 연결된 MCP 서버 도구 호출 |
| `prompt` | Claude 모델에 yes/no 판단 위임 |
| `agent` | 서브에이전트 생성 (실험적) |

**공통 선택 필드**:

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `if` | string | - | 권한 룰 구문 필터 (예: `Bash(rm *)`) — 툴 이벤트에만 적용 |
| `timeout` | number | 600 | 타임아웃(초). `prompt`는 30, `agent`는 60 |
| `statusMessage` | string | - | 훅 실행 중 스피너 메시지 |
| `async` | boolean | false | `command` 전용 — 비동기 실행 |

**경로 플레이스홀더**:

| 플레이스홀더 | 설명 |
|-------------|------|
| `${CLAUDE_PROJECT_DIR}` | 프로젝트 루트 절대 경로 |
| `${CLAUDE_PLUGIN_ROOT}` | 플러그인 설치 디렉토리 |
| `${CLAUDE_PLUGIN_DATA}` | 플러그인 영구 데이터 디렉토리 |

---

### 4. stdin JSON 구조

모든 이벤트에서 공통으로 수신하는 필드:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse"
}
```

`PreToolUse` / `PostToolUse`에서 추가로 수신하는 필드:

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite"
  },
  "tool_use_id": "tool-call-unique-id"
}
```

`PostToolUse`에는 `tool_output` 필드도 포함된다.

---

### 5. stdout JSON 구조

훅이 CC에 돌려주는 응답. 성공(`exit 0`) 시 stdout이 파싱된다.

**공통 필드**:

```json
{
  "continue": true,
  "stopReason": "optional — continue=false 시 표시할 메시지",
  "suppressOutput": false,
  "systemMessage": "사용자에게 보여줄 경고",
  "terminalSequence": "]777;notify;title;message"
}
```

**PreToolUse — 툴 허용/차단 결정**:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask|defer",
    "permissionDecisionReason": "설명",
    "updatedInput": {},
    "additionalContext": "Claude에게 전달할 컨텍스트"
  }
}
```

**터미널 알림** (`terminalSequence`):

| 시퀀스 | 지원 터미널 |
|--------|------------|
| `\033]777;notify;제목;메시지\007` | urxvt, Ghostty, Warp |
| `\033]9;메시지\007` | iTerm2, ConEmu, Windows Terminal, WezTerm |
| `\033]99;i=제목:b=메시지\007` | Kitty |
| BEL (`\007`) | 시스템 벨 |

---

### 6. 실전 패턴

#### 패턴 A: 자동 포맷 (PostToolUse)

파일 저장 후 확장자별로 포매터 자동 실행.

```json
// ~/.claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'file=$(echo \"$HOOK_INPUT\" | jq -r \".tool_input.file_path\"); case \"$file\" in *.rs) rustfmt \"$file\" ;; *.js|*.ts|*.tsx) prettier --write \"$file\" ;; esac'",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

실무에서는 stdin JSON을 파싱하는 별도 스크립트로 분리하는 것이 낫다:

```bash
#!/bin/bash
# .claude/hooks/format.sh
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0

case "$file" in
  *.rs)             rustfmt "$file" ;;
  *.js|*.ts|*.tsx)  prettier --write "$file" ;;
  *.py)             black "$file" ;;
esac
exit 0
```

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/format.sh"
          }
        ]
      }
    ]
  }
}
```

#### 패턴 B: console.log / debugger 감지 (Stop)

응답 완료 시점에 JS/TS 파일에 잔존 디버그 코드 확인.

```bash
#!/bin/bash
# .claude/hooks/check-debug.sh
result=$(grep -rn "console\.log\|debugger" --include="*.js" --include="*.ts" --include="*.tsx" . 2>/dev/null | head -5)
if [ -n "$result" ]; then
  echo "경고: console.log / debugger 잔존:" >&2
  echo "$result" >&2
fi
exit 0  # exit 1이 아님 — 비블로킹 경고
```

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/check-debug.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

> `Stop` 이벤트에는 matcher가 없다 — `matcher` 필드 생략.

#### 패턴 C: 위험한 Bash 명령 차단 (PreToolUse)

```bash
#!/bin/bash
# .claude/hooks/validate-bash.sh
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

if echo "$command" | grep -qE '(rm -rf /|mkfs\.|dd if=.*of=/dev)'; then
  jq -n '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": "위험한 명령이 감지되어 차단되었습니다."
    }
  }'
  exit 0  # JSON 출력 후 exit 0 — deny는 stdout JSON으로 처리
fi
exit 0
```

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/validate-bash.sh"
          }
        ]
      }
    ]
  }
}
```

#### 패턴 D: 테스트 자동 실행 (PostToolUse)

특정 파일 수정 후 관련 테스트 자동 실행.

```bash
#!/bin/bash
# .claude/hooks/run-tests.sh
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# src/ 파일 변경 시에만 실행
if echo "$file" | grep -q "^/.*src/"; then
  npm run test --silent 2>&1 | tail -5 >&2
fi
exit 0
```

#### 패턴 E: 커밋 전 린트 (PreToolUse + if)

`git commit` 명령 직전에만 린트 실행.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "if": "Bash(git commit*)",
        "hooks": [
          {
            "type": "command",
            "command": "npm run lint",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

`if` 필드 규칙:
- 권한 룰 구문 사용 (`Bash(git commit *)`, `Edit(*.ts)` 등)
- 툴 이벤트에서만 동작 (`PreToolUse`, `PostToolUse` 등)
- `&&` / `||` 불가 — 조건별로 핸들러를 분리할 것

---

## 버전별 차이

| 기능 | v2.0.x | v2.1.x |
|------|--------|--------|
| Hooks 기본 지원 | 제한적 | 전체 이벤트 지원 |
| `/dev/tty` 접근 | 불명 | v2.1.139 기준 macOS/Linux 불가, Windows 없음 |
| `terminalSequence` 필드 | 불명 | 지원 (알림 대체 수단) |
| `async` / `asyncRewake` | 불명 | command 훅에서 지원 |
| `disableAllHooks` | 불명 | 지원 |

<!-- TODO: v2.0.x hooks 지원 범위 bundle.js 분석 필요 -->

---

## 자주 하는 실수

1. **`exit 1`로 차단 시도** — `1`은 비블로킹. stderr가 트랜스크립트에 표시될 뿐 액션은 계속 진행된다. 차단하려면 반드시 `exit 2`.

2. **stdout에 JSON 외 텍스트 혼재** — 쉘 스타트업 노이즈(`.bashrc` echo, `nvm` 메시지 등)가 stdout에 섞이면 JSON 파싱 실패. 스크립트 실행 환경에서 stdout을 오염시키는 출력을 제거하거나 `suppressOutput: true` 사용.

3. **`/dev/tty` 직접 접근 시도** — 훅은 터미널 없이 실행된다. 데스크탑 알림은 `terminalSequence` 필드로 OSC 이스케이프 시퀀스를 전송해야 한다.

4. **`PreToolUse` deny를 `exit 2`로 처리** — `exit 2`는 stderr를 표시하고 차단하지만, 더 명확한 방법은 `exit 0` + stdout JSON의 `permissionDecision: "deny"`. 이유(`permissionDecisionReason`)를 함께 전달할 수 있다.

5. **`Stop` 이벤트에 matcher 지정** — `Stop`은 matcher를 지원하지 않는다. `matcher` 필드를 써도 무시되거나 항상 발동된다. 핸들러 배열에 matcher 없이 바로 정의.

6. **stdout 10,000자 초과** — stdout은 10,000자로 잘린다. 긴 출력이 필요하면 파일로 저장하거나 `suppressOutput: true`로 디버그 로그에서 제외.

7. **동일 핸들러 중복 등록** — 같은 command 문자열 또는 URL을 가진 핸들러는 자동 중복 제거된다. 의도치 않게 조건별로 같은 스크립트를 등록했을 때 한 번만 실행될 수 있다.

---

## 참고

- 공식 Hooks 문서: https://code.claude.com/docs/en/hooks
- Settings 구조: https://code.claude.com/docs/en/settings
- 권한 룰 구문 (`if` 필드): https://code.claude.com/docs/en/permissions
- 관련 챕터: `chapters/01-concepts.md`, `chapters/02-config.md`, `chapters/04-mcp.md`

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/ryujaeuk/cc-gnothi</sub>
