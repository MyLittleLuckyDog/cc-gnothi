---
type: feature-spec
feature: "output-formats"
cc_version: "2.1.143"
updated: 2026-05-17
tags: ["output", "print-mode", "headless", "json", "stream-json", "pipe", "automation", "ci", "max-turns", "stdin", "structured-output", "output-format"]
related:
  - docs/chapters/01-concepts.md
  - docs/chapters/10-patterns.md
source: "official-docs-bootstrap"
bundle_verified: false
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
---

# 출력 포맷 제어

> 이 챕터: `-p` (print mode) 에서의 출력 포맷 — `text` / `json` / `stream-json` 각 형식, JSON 스키마, 스트리밍 이벤트, 파이프 패턴, CI 자동화.  
> 최소 버전: v2.1.0 | stdin 상한 10MB: v2.1.128+

---

## 개념

`claude -p` (print mode, `--print`) 는 인터랙티브 루프 없이 단일 응답을 stdout으로 출력하고 종료한다. CI·스크립트·파이프라인의 기반 모드다.

출력 형식은 `--output-format` 플래그로 제어한다.

| 형식 | 기본값 | 용도 |
|---|---|---|
| `text` | 기본값 | 사람이 읽는 일반 텍스트 출력 |
| `json` | — | 메타데이터 포함 JSON. 스크립트 파싱용 |
| `stream-json` | — | 줄 단위 JSON 이벤트 스트림. 실시간 처리용 |

> **인터랙티브 전용**: `/commands`, 스킬, 슬래시 커맨드는 `-p` 모드에서 동작하지 않는다.  
> **`--bare` 권장**: CI에서는 `--bare`를 함께 써야 로컬 hooks·MCP가 개입하지 않는다.

---

## 패턴

### 1. `--output-format` 플래그

| 값 | 설명 | 예시 |
|---|---|---|
| `text` | 평문 텍스트 (기본값) | `claude -p "query"` |
| `json` | 완료 후 단일 JSON 객체 출력 | `claude -p "query" --output-format json` |
| `stream-json` | 이벤트마다 JSON 한 줄씩 스트림 | `claude -p "query" --output-format stream-json` |

---

### 2. `json` 출력 구조

`--output-format json` 사용 시 완료 후 단일 JSON 객체가 stdout으로 출력된다.

```json
{
  "type": "result",
  "subtype": "success",
  "result": "Claude의 텍스트 응답",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_cost_usd": 0.0012,
  "duration_ms": 3420,
  "duration_api_ms": 3100,
  "num_turns": 2,
  "is_error": false
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `type` | `"result"` | 메시지 타입 |
| `subtype` | `"success"` \| `"error_..."` | 성공·실패 구분 |
| `result` | string | 텍스트 응답 본문 |
| `session_id` | string (UUID) | 세션 식별자. `--resume`에 재사용 가능 |
| `total_cost_usd` | number | 전체 API 호출 비용(USD) |
| `duration_ms` | number | 전체 경과 시간(ms) |
| `duration_api_ms` | number | API 순수 호출 시간(ms) |
| `num_turns` | number | 에이전트 턴 수 |
| `is_error` | boolean | 오류 여부 |

**`--json-schema`와 조합 시**: `structured_output` 필드가 추가된다.

```json
{
  "type": "result",
  "subtype": "success",
  "result": "...",
  "structured_output": { "functions": ["main", "parse"] },
  "session_id": "...",
  "total_cost_usd": 0.0015
}
```

`subtype` 오류값:

| subtype | 의미 |
|---|---|
| `success` | 정상 완료 |
| `error_max_structured_output_retries` | 구조화 출력 스키마 검증 반복 실패 |

---

### 3. `stream-json` 이벤트 타입

`--output-format stream-json`은 줄 단위(newline-delimited) JSON을 실시간으로 방출한다. `--include-partial-messages` 플래그를 추가하면 토큰 수준 델타도 수신한다.

**기본 이벤트 흐름** (`stream-json` 단독):

```
system/init        ← 세션 메타데이터 (첫 번째 이벤트)
assistant          ← 완성된 어시스턴트 메시지
tool_use           ← 도구 호출
tool_result        ← 도구 결과
result             ← 최종 결과 (json 형식과 동일한 구조)
```

**`--include-partial-messages` 추가 시 `stream_event` 포함**:

| 이벤트 타입 (`event.type`) | 설명 |
|---|---|
| `message_start` | 새 메시지 시작 |
| `content_block_start` | 텍스트 또는 도구 호출 블록 시작 |
| `content_block_delta` | 증분 업데이트. `delta.type`으로 세분화 |
| `content_block_stop` | 블록 종료 |
| `message_delta` | 메시지 수준 업데이트 (stop_reason, usage) |
| `message_stop` | 메시지 종료 |

`content_block_delta` 내 `delta.type` 값:

| delta.type | 데이터 필드 | 설명 |
|---|---|---|
| `text_delta` | `delta.text` | 텍스트 청크 |
| `input_json_delta` | `delta.partial_json` | 도구 입력 JSON 청크 |

**`system/init` 이벤트** — 세션 첫 이벤트로 메타데이터 제공:

| 필드 | 설명 |
|---|---|
| `plugins` | 로드된 플러그인 목록 (`name`, `path`) |
| `plugin_errors` | 로드 실패 플러그인 (`plugin`, `type`, `message`) |

**`system/api_retry` 이벤트** — API 재시도 직전 방출:

| 필드 | 타입 | 설명 |
|---|---|---|
| `type` | `"system"` | — |
| `subtype` | `"api_retry"` | — |
| `attempt` | integer | 현재 시도 번호 (1부터) |
| `max_retries` | integer | 최대 재시도 허용 횟수 |
| `retry_delay_ms` | integer | 다음 시도까지 대기 시간(ms) |
| `error_status` | integer \| null | HTTP 상태 코드. 연결 오류는 `null` |
| `error` | string | 오류 범주 |
| `uuid` | string | 이벤트 고유 ID |
| `session_id` | string | 이벤트 귀속 세션 |

`error` 값: `authentication_failed`, `oauth_org_not_allowed`, `billing_error`, `rate_limit`, `invalid_request`, `server_error`, `max_output_tokens`, `unknown`

---

### 4. `--include-hook-events` — 훅 이벤트 포함

`--output-format stream-json`이 필요하다. 훅 라이프사이클 이벤트가 스트림에 포함된다.

```bash
claude -p "query" --output-format stream-json --include-hook-events
```

---

### 5. stdin 파이프 패턴

non-interactive 모드는 stdin을 읽는다.

**기본 패턴**:

```bash
# 파일 내용 파이프
cat build-error.txt | claude -p "이 빌드 오류의 근본 원인을 간결히 설명해"

# 출력을 파일로 리디렉션
cat build-error.txt | claude -p "explain root cause" > output.txt

# git diff 파이프
git diff main | claude -p "타입 오류 확인"

# JSON으로 받아 jq 파싱
claude -p "Summarize this project" --output-format json | jq -r '.result'
```

**stdin 상한**: v2.1.128+ 기준 **10MB**. 초과 시 비정상 상태 코드로 종료하고 명확한 오류 메시지를 출력한다.  
10MB 이상 입력은 파일에 저장한 뒤 경로를 프롬프트에 전달하는 방식으로 우회한다.

```bash
# stdin 대신 파일 경로 전달로 10MB 제한 우회
claude -p "large-file.log 파일을 분석해서 오류 패턴을 찾아라" --allowedTools "Read"
```

---

### 6. `--max-turns` — 에이전트 턴 제한

print mode 전용. 에이전트 루프 반복 횟수의 상한을 설정한다. 기본값: 무제한. 상한에 도달하면 오류로 종료한다.

```bash
# 최대 3턴
claude -p "test suite 실행 후 실패 수정" --max-turns 3 --allowedTools "Bash,Read,Edit"
```

환경변수로도 설정 가능: `CLAUDE_CODE_MAX_TURNS`

---

### 7. `--json-schema` — 스키마 기반 구조화 출력

print mode 전용. `--output-format json`과 함께 사용한다. JSON Schema를 전달하면 에이전트가 작업 완료 후 스키마를 만족하는 JSON을 `structured_output` 필드로 반환한다. 검증 실패 시 재시도. 반복 실패 시 `subtype: error_max_structured_output_retries`.

```bash
claude -p "auth.py에서 함수 이름을 추출해라" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}' \
  | jq '.structured_output'
```

---

### 8. 스트리밍 출력 — 토큰 실시간 수신

```bash
# 텍스트 델타만 추출하여 실시간 출력
claude -p "재귀를 설명해라" \
  --output-format stream-json \
  --verbose \
  --include-partial-messages \
  | jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

필수 플래그 조합:

| 목적 | 필요 플래그 |
|---|---|
| 완성된 메시지만 스트림 | `--output-format stream-json` |
| 토큰 수준 실시간 스트림 | `--output-format stream-json --include-partial-messages` |
| 훅 이벤트도 포함 | `--output-format stream-json --include-hook-events` |

---

### 9. CI/자동화 파이프 패턴

**package.json 린터 스크립트**:

```json
{
  "scripts": {
    "lint:claude": "git diff main | claude -p \"타입 오류만 보고해. 파일명:라인 형식으로.\" --bare"
  }
}
```

**세션 ID 캡처 후 대화 이어가기**:

```bash
session_id=$(claude -p "코드베이스 성능 검토 시작" --output-format json | jq -r '.session_id')
claude -p "DB 쿼리에 집중해서 추가 분석" --resume "$session_id"
claude -p "발견한 모든 이슈를 요약해라" --resume "$session_id"
```

**CI 권장 패턴** (`--bare` + `--allowedTools` + `--output-format json`):

```bash
claude --bare -p "staged 변경사항을 검토하고 커밋 메시지를 작성해라" \
  --allowedTools "Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git commit *)" \
  --output-format json
```

**비용 추적** (`--output-format json` 사용 시 `total_cost_usd` 포함):

```bash
result=$(claude -p "query" --output-format json)
cost=$(echo "$result" | jq -r '.total_cost_usd')
echo "비용: $cost USD"
```

**최대 예산 설정** (`--max-budget-usd`):

```bash
claude -p "광범위한 리팩터링" --max-budget-usd 5.00 --output-format json
```

**자동 폴백 모델** (`--fallback-model`, print mode 전용):

```bash
claude -p "query" --fallback-model claude-sonnet-4-6 --output-format json
```

**프롬프트 캐시 재사용 향상** (`--exclude-dynamic-system-prompt-sections`):

```bash
# 머신별 시스템 프롬프트 섹션을 첫 번째 사용자 메시지로 이동
# → 다른 사용자·머신에서 동일 태스크 실행 시 캐시 히트율 향상
claude -p --exclude-dynamic-system-prompt-sections "query"
```

**`--input-format stream-json`** — stdin을 stream-json 형식으로 수신:

```bash
claude -p \
  --input-format stream-json \
  --output-format stream-json \
  --replay-user-messages
```

---

## 버전별 차이

| 기능 | 버전 | 내용 |
|---|---|---|
| `--output-format` (`text`/`json`/`stream-json`) | v2.1.0+ | print mode 출력 포맷 |
| `--max-turns` | v2.1.0+ | 에이전트 턴 수 제한 |
| stdin 10MB 상한 | v2.1.128+ | 초과 시 명확한 오류 + 비정상 종료 |
| `--bare` 모드 | v2.1.x+ | CI 권장. 향후 `-p` 기본값 예정 |
| `--json-schema` | v2.1.x+ | 스키마 기반 구조화 출력 (print mode) |
| `--include-partial-messages` | v2.1.x+ | 토큰 수준 스트리밍 (`stream-json` 필요) |
| `--include-hook-events` | v2.1.x+ | 훅 이벤트 스트림 포함 (`stream-json` 필요) |
| `--exclude-dynamic-system-prompt-sections` | v2.1.x+ | 프롬프트 캐시 재사용 향상 |
| `--replay-user-messages` | v2.1.x+ | stdin 사용자 메시지 재방출 (`stream-json` 필요) |
| Agent SDK credit 분리 | 2026-06-15+ | 구독 플랜에서 `-p` 사용량이 별도 크레딧 차감 |

---

## 자주 하는 실수

1. **`--output-format json`을 인터랙티브 모드에서 사용** — `--output-format`은 `-p` (print mode) 전용이다. 인터랙티브 세션에서는 효과 없다.

2. **`--include-partial-messages` 단독 사용** — `--output-format stream-json`과 `-p`가 모두 있어야 동작한다. 없으면 무시된다.

3. **`--include-hook-events` 단독 사용** — `--output-format stream-json`이 필요하다.

4. **stdin 10MB 초과 파이프** — v2.1.128+ 에서 비정상 종료. 대신 파일 경로를 프롬프트에 전달하고 `Read` 도구를 허용한다.

5. **`--max-turns`를 인터랙티브 모드에서 사용** — print mode 전용 플래그. 인터랙티브에서는 무시된다.

6. **CI에서 `--bare` 생략** — 로컬 `~/.claude/` hooks, MCP 서버, CLAUDE.md가 개입해 CI 머신과 개발 머신의 동작이 달라진다.

7. **`--json-schema` 없이 `structured_output` 필드 기대** — 이 필드는 `--json-schema`를 사용해야만 JSON 응답에 포함된다.

8. **`session_id`를 `result` 필드로 착각** — 텍스트 응답은 `.result`, 세션 ID는 `.session_id`다.

---

## 참고

- 공식 headless/print mode 가이드: https://code.claude.com/docs/en/headless
- CLI 플래그 전체 목록: https://code.claude.com/docs/en/cli-reference
- Agent SDK 스트리밍: https://code.claude.com/docs/en/agent-sdk/streaming-output
- Agent SDK 구조화 출력: https://code.claude.com/docs/en/agent-sdk/structured-outputs
- 관련 챕터: `chapters/01-concepts.md`

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/ryujaeuk/cc-gnothi</sub>
