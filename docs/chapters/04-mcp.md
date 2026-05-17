---
type: chapter
chapter: "04"
title: "MCP — Model Context Protocol"
cc_version_min: "2.1.0"
updated: 2026-05-17
tags: ["mcp", "model-context-protocol", "stdio", "http", "sse", "scope", "mcp-json", "tools", "integration", "oauth"]
related:
  - chapters/01-concepts.md
  - chapters/02-config.md
  - chapters/06-hooks.md
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
---

# MCP — Model Context Protocol

> 이 챕터: CC가 외부 서비스·DB·API에 연결하는 방법 — 프로토콜, 스코프, 설정 파일 구조, 승인·제한 관리.  
> 최소 버전: v2.1.0

## 개념

MCP(Model Context Protocol)는 CC가 외부 도구·데이터 소스와 연결하는 오픈 표준이다. MCP 서버를 연결하면 CC가 이슈 트래커, 모니터링 대시보드, DB 등에 직접 접근할 수 있다 — 데이터를 복사해서 붙여넣는 대신.

**사용 이유**: 다른 도구에서 데이터를 직접 채팅에 복사하고 있다면, MCP 서버를 연결하면 CC가 그 시스템에 직접 읽고 쓸 수 있다.

**Tool Search (기본 활성화)**: 세션 시작 시 도구 이름만 로드, 실제 사용할 때 스키마를 fetch. MCP 서버를 많이 연결해도 컨텍스트 소비를 최소화한다. (v2.1.0+, Sonnet 4 / Opus 4 이상 모델 필요)

---

## 패턴

### 1. 연결 방식 3가지

| 방식 | 권장 여부 | 명령 예시 |
|------|----------|----------|
| **HTTP** (`streamable-http`) | 권장 — 클라우드 서비스 표준 | `claude mcp add --transport http notion https://mcp.notion.com/mcp` |
| **SSE** | Deprecated — 가능하면 HTTP 사용 | `claude mcp add --transport sse asana https://mcp.asana.com/sse` |
| **stdio** | 로컬 프로세스, 시스템 직접 접근 필요 시 | `claude mcp add --transport stdio --env KEY=val myserver -- npx server` |

> `.mcp.json`의 `type` 필드에서 `streamable-http`는 `http`의 별칭. MCP 공식 스펙 이름이므로 서버 문서를 그대로 복사해도 동작한다.

#### HTTP 서버 추가

```bash
# 기본
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Bearer 토큰 인증
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer YOUR_GITHUB_PAT"
```

#### stdio 서버 추가

```bash
# 옵션은 서버 이름 앞, 명령은 -- 뒤
claude mcp add --transport stdio --env AIRTABLE_API_KEY=YOUR_KEY airtable \
  -- npx -y airtable-mcp-server

# DB 연결 예시
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://readonly:pass@prod.db.com:5432/analytics"
```

> **옵션 순서**: `--transport`, `--env`, `--scope`, `--header`는 반드시 서버 이름 앞에 위치. `--` 이후가 서버에 전달되는 명령과 인수.

---

### 2. 스코프 — 어디에 저장되는가

공식 문서 기준 스코프는 3가지다. (`global`은 `user`의 구버전 이름, 구버전 `project`는 현재 `local`로 이름 변경됨)

| 스코프 | 기본값 | 적용 범위 | 팀 공유 | 저장 위치 |
|--------|--------|----------|--------|----------|
| `local` | 기본값 | 현재 프로젝트만 | 아니오 | `~/.claude.json` (프로젝트 경로 아래) |
| `project` | — | 현재 프로젝트만 | 예 (버전 관리) | `.mcp.json` (프로젝트 루트) |
| `user` | — | 전 프로젝트 | 아니오 | `~/.claude.json` |

```bash
# local (기본)
claude mcp add --transport http stripe https://mcp.stripe.com

# project (팀 공유 — .mcp.json에 기록)
claude mcp add --transport http paypal --scope project https://mcp.paypal.com/mcp

# user (전 프로젝트 개인 사용)
claude mcp add --transport http hubspot --scope user https://mcp.hubspot.com/anthropic
```

> **주의**: `local` 스코프는 `~/.claude.json` (홈 디렉토리)에 저장. `.claude/settings.local.json` (프로젝트 디렉토리의 일반 설정 파일)과 다른 파일이다.

#### 스코프 우선순위 (높음 → 낮음)

1. local
2. project
3. user
4. 플러그인 제공 서버
5. claude.ai 커넥터

같은 이름의 서버가 여러 스코프에 정의된 경우 가장 높은 우선순위 하나만 연결.

---

### 3. `.mcp.json` 구조

`project` 스코프 서버는 프로젝트 루트의 `.mcp.json`에 저장된다. 이 파일은 버전 관리에 포함하도록 설계됐다.

```json
{
  "mcpServers": {
    "shared-server": {
      "command": "/path/to/server",
      "args": [],
      "env": {}
    },
    "api-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    },
    "core-tools": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "alwaysLoad": true
    }
  }
}
```

#### `.mcp.json` 주요 필드

| 필드 | 설명 | 적용 대상 |
|------|------|----------|
| `type` | `http` / `streamable-http` / `sse` / `stdio` | 모든 서버 |
| `command` | 실행 파일 경로 | stdio |
| `args` | 명령 인수 배열 | stdio |
| `env` | 서버에 주입할 환경 변수 | stdio |
| `url` | 원격 서버 URL | HTTP / SSE |
| `headers` | HTTP 요청 헤더 (인증 등) | HTTP / SSE |
| `alwaysLoad` | `true` 시 Tool Search 우회, 항상 스키마 로드 (v2.1.121+) | 모든 서버 |
| `oauth.scopes` | 요청할 OAuth 스코프 공백 구분 문자열 | HTTP |
| `headersHelper` | 연결 시 실행해 동적 헤더를 반환하는 쉘 명령 | HTTP |

#### 환경 변수 확장

`.mcp.json`의 `command`, `args`, `env`, `url`, `headers` 필드에서 지원:

| 구문 | 동작 |
|------|------|
| `${VAR}` | 환경 변수 `VAR` 값으로 치환 |
| `${VAR:-default}` | `VAR`가 미설정이면 `default` 사용 |

값이 없고 기본값도 없으면 설정 파싱 실패.

---

### 4. 서버 관리 명령

```bash
# 서버 목록
claude mcp list

# 특정 서버 상세 (OAuth 설정 포함)
claude mcp get github

# 서버 제거
claude mcp remove github

# JSON으로 직접 추가
claude mcp add-json weather-api '{"type":"http","url":"https://api.weather.com/mcp"}'

# Claude Desktop 설정에서 가져오기 (macOS / WSL만 지원)
claude mcp add-from-claude-desktop

# 프로젝트 승인 초기화
claude mcp reset-project-choices

# CC 자체를 MCP 서버로 실행
claude mcp serve
```

```bash
# 세션 내 서버 상태 확인 및 OAuth 인증
/mcp
```

`/mcp` 패널: 각 서버의 도구 수 표시, 인증 필요 서버 표시, OAuth 로그인 흐름 시작.

---

### 5. 승인 관리

#### project 스코프 `.mcp.json` 서버 승인

`.mcp.json`의 프로젝트 스코프 서버는 처음 사용 시 승인 요청이 표시된다.

```bash
# 승인 선택 초기화 (재승인 요청 유도)
claude mcp reset-project-choices
```

#### 기업 관리자용 — managed-mcp.json (Option 1: 완전 제어)

시스템 전체에 고정 서버 세트를 배포하고 사용자 추가를 차단:

| OS | 파일 경로 |
|----|----------|
| macOS | `/Library/Application Support/ClaudeCode/managed-mcp.json` |
| Linux / WSL | `/etc/claude-code/managed-mcp.json` |
| Windows | `C:\Program Files\ClaudeCode\managed-mcp.json` |

파일 형식은 `.mcp.json`과 동일. 이 파일이 존재하면 사용자는 `claude mcp add`로 서버를 추가할 수 없다.

#### 기업 관리자용 — allowlist / denylist (Option 2: 정책 기반)

managed settings 파일에서 `allowedMcpServers` / `deniedMcpServers` 설정:

```json
{
  "allowedMcpServers": [
    { "serverName": "github" },
    { "serverCommand": ["npx", "-y", "@modelcontextprotocol/server-filesystem"] },
    { "serverUrl": "https://mcp.company.com/*" }
  ],
  "deniedMcpServers": [
    { "serverUrl": "https://*.untrusted.com/*" }
  ]
}
```

| 매칭 키 | 설명 |
|---------|------|
| `serverName` | 설정된 서버 이름으로 매칭 |
| `serverCommand` | stdio 서버 실행 명령과 인수 배열 정확 매칭 |
| `serverUrl` | 원격 서버 URL, `*` 와일드카드 지원 |

- `allowedMcpServers: []` → 모든 MCP 차단
- `allowedMcpServers: undefined` → 제한 없음 (기본)
- denylist는 allowlist보다 항상 우선

---

### 6. OAuth 인증

원격 서버가 `401` / `403` 응답 시 `/mcp`에 인증 필요 표시. OAuth 2.0 흐름 지원.

```bash
# 서버 추가 후
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp

# 세션 내에서 인증
/mcp
# → 브라우저 로그인 흐름 진행
```

#### 사전 등록 OAuth 자격증명이 필요한 서버

```bash
claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp
```

- `--callback-port` : OAuth 콜백 포트 고정 (사전 등록 redirect URI와 일치시킬 때)
- `--client-id` : 앱 클라이언트 ID
- `--client-secret` : 마스크 입력 프롬프트로 시크릿 입력 (CI에서는 `MCP_CLIENT_SECRET` 환경 변수)
- 시크릿은 시스템 키체인 (macOS) 또는 자격증명 파일에 저장, 설정 파일에 평문 저장 안 됨

---

### 7. 주요 공개 MCP 서버 예시

| 서비스 | 방식 | 명령 |
|--------|------|------|
| Notion | HTTP | `claude mcp add --transport http notion https://mcp.notion.com/mcp` |
| GitHub | HTTP | `claude mcp add --transport http github https://api.githubcopilot.com/mcp/ --header "Authorization: Bearer PAT"` |
| Sentry | HTTP | `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp` |
| Asana | SSE (deprecated) | `claude mcp add --transport sse asana https://mcp.asana.com/sse` |
| PostgreSQL | stdio | `claude mcp add --transport stdio db -- npx -y @bytebase/dbhub --dsn "postgresql://..."` |
| Airtable | stdio | `claude mcp add --transport stdio --env AIRTABLE_API_KEY=KEY airtable -- npx -y airtable-mcp-server` |

공개 서버 디렉토리: https://claude.ai/directory

---

### 8. 고급 — 자주 쓰는 환경 변수

| 환경 변수 | 기본값 | 설명 |
|-----------|--------|------|
| `MCP_TIMEOUT` | — | 서버 시작 타임아웃 (ms). 예: `MCP_TIMEOUT=10000 claude` |
| `MAX_MCP_OUTPUT_TOKENS` | 25,000 | 도구 출력 최대 토큰. 10,000 초과 시 경고 표시 |
| `ENABLE_TOOL_SEARCH` | unset | MCP 도구 검색 제어 (아래 표 참고) |
| `ENABLE_CLAUDEAI_MCP_SERVERS` | true | `false`로 설정 시 claude.ai 연동 서버 비활성화 |
| `MCP_CONNECTION_NONBLOCKING` | — | `1`로 설정 시 stdio 외 서버 백그라운드 연결 (`alwaysLoad` 서버 제외) |

#### ENABLE_TOOL_SEARCH 값

| 값 | 동작 |
|----|------|
| (미설정) | 기본값: 모든 MCP 도구 지연 로드. Vertex AI / 비공식 프록시에서는 일괄 업프론트 로드로 폴백 |
| `true` | 강제 지연 로드 (Vertex AI 포함). 미지원 프록시에서 요청 실패 가능 |
| `auto` | 컨텍스트 창의 10% 이내 시 업프론트, 초과 시 지연 |
| `auto:N` | 임계값 N% 커스텀 지정 |
| `false` | 모든 도구 즉시 업프론트 로드 |

---

### 9. 고급 — MCP 리소스 참조와 프롬프트

#### 리소스 @ 참조

```
@server:protocol://resource/path
```

예: `@github:issue://123`, `@postgres:schema://users`

프롬프트에서 `@` 입력 시 자동완성 목록에 MCP 리소스와 파일이 함께 표시.

#### MCP 프롬프트 명령

MCP 서버가 노출하는 프롬프트는 `/mcp__servername__promptname` 형식으로 사용:

```
/mcp__github__list_prs
/mcp__jira__create_issue "Bug in login flow" high
```

---

## 버전별 차이

| 기능 | 버전 | 비고 |
|------|------|------|
| MCP 기본 지원 | v2.1.0+ | HTTP / SSE / stdio |
| Tool Search (지연 로드) | v2.1.0+ | Sonnet 4 / Opus 4 이상 모델 필요 |
| `alwaysLoad` 필드 | v2.1.121+ | Tool Search 우회, 개별 서버 또는 도구 단위 |
| HTTP 초기 연결 재시도 | v2.1.121+ | 5xx / 타임아웃 / 연결 거부 시 최대 3회 재시도 |
| OAuth `authServerMetadataUrl` | v2.1.64+ | 커스텀 OAuth 메타데이터 URL 지정 |
| SSE transport | — | Deprecated. HTTP 사용 권장 |
| 스코프 이름 변경 | — | 구 `project` → `local`, 구 `global` → `user` |

---

## 자주 하는 실수

1. **옵션을 서버 이름 뒤에 붙임** — `--transport`, `--env`, `--scope` 등은 반드시 서버 이름 **앞**에. `--` 이후는 서버 명령에만 전달됨.

2. **`workspace` 이름 사용** — 예약어. 이 이름으로 서버를 정의하면 CC가 시작 시 스킵하고 경고를 표시한다.

3. **SSE를 신규 서버에 사용** — SSE는 Deprecated. 새 서버는 HTTP(`streamable-http`)로 구성.

4. **`.mcp.json` 환경 변수를 미설정하고 기본값도 생략** — `${VAR}`에 값이 없고 `${VAR:-default}`도 없으면 설정 파싱 자체가 실패한다.

5. **`local` 스코프 저장 위치 혼동** — MCP local 스코프는 `~/.claude.json` (홈). 일반 local 설정 `.claude/settings.local.json` (프로젝트 내)과 다른 파일이다.

6. **stdio 서버 연결 끊김 후 재연결 기대** — stdio 서버는 자동 재연결 없음. HTTP / SSE는 최대 5회 지수 백오프 재시도.

7. **외부 콘텐츠를 fetch하는 서버 무검증 연결** — 프롬프트 인젝션 위험. 신뢰할 수 있는 서버만 연결.

8. **Tool Search가 지원되지 않는 모델에서 오류** — Haiku 모델은 `tool_reference` 블록 미지원. Tool Search가 활성화된 환경에서 Haiku 사용 시 실패할 수 있다.

---

## 참고

- 공식 MCP 문서: https://code.claude.com/docs/en/mcp
- MCP 공식 스펙: https://modelcontextprotocol.io/introduction
- 공개 서버 디렉토리: https://claude.ai/directory
- Channels (이벤트 푸시): https://code.claude.com/docs/en/channels
- 관련 챕터: `chapters/01-concepts.md`, `chapters/02-config.md`, `chapters/06-hooks.md`

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/ryujaeuk/cc-gnothi</sub>
