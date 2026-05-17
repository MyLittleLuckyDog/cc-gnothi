---
type: reference
title: "Claude Code 환경변수 전체 레퍼런스"
updated: "2026-05-17"
tags: ["env", "environment-variables", "reference", "configuration"]
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
source: "https://code.claude.com/docs/en/env-vars, https://code.claude.com/docs/en/settings, https://code.claude.com/docs/en/cli-reference"
stale_risk: high
---

# Claude Code 환경변수 전체 레퍼런스

> 출처: 공식 문서 직접 fetch 기반 (2026-05-17).  
> bundle.js 분석 아님 — bundle 분석과 충돌 시 bundle 우선.

---

## 설정 방법 및 우선순위

### 우선순위 (높음 → 낮음)

| 순위 | 소스 | 비고 |
|------|------|------|
| 1 | CLI 플래그 (`--model`, `--effort` 등) | 세션 1회만 적용 |
| 2 | 셸 환경변수 (`export VAR=val`) | 현재 셸 세션 유효 |
| 3 | `settings.json` `env` 키 | 영구 적용, 팀 배포용 |
| 4 | 기본값 | 문서 명시 기본값 |

### settings.json `env` 키 사용

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "BASH_MAX_TIMEOUT_MS": "600000",
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1"
  }
}
```

### .env 파일 지원

공식 문서에 `.env` 파일 자동 로드 언급 없음. 셸 `export` 또는 `settings.json` `env` 키 사용.

---

## 카테고리별 환경변수

### 인증

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | API 키 (`X-Api-Key` 헤더). 비대화형 모드에서 구독 대체, 대화형 모드에서 승인 요청 | 없음 |
| `ANTHROPIC_AUTH_TOKEN` | String | 커스텀 `Authorization` 헤더 값 (`Bearer ` 자동 접두사) | 없음 |
| `CLAUDE_CODE_OAUTH_TOKEN` | String | Claude.ai OAuth 액세스 토큰 | 없음 |
| `CLAUDE_CODE_OAUTH_REFRESH_TOKEN` | String | Claude.ai OAuth 리프레시 토큰 | 없음 |
| `CLAUDE_CODE_OAUTH_SCOPES` | 공백 구분 String | OAuth 리프레시 토큰용 스코프 | 없음 |
| `ANTHROPIC_WORKSPACE_ID` | String | 워크로드 아이덴티티 페더레이션용 워크스페이스 ID | 없음 |

---

### 모델·API

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | 사용할 기본 모델 (`--model` 플래그로 재정의 가능) | 없음 |
| `ANTHROPIC_BETAS` | 쉼표 구분 String | `anthropic-beta` 헤더에 추가할 베타 기능 목록 | 없음 |
| `ANTHROPIC_BASE_URL` | URL | 프록시·게이트웨이용 API 엔드포인트 재정의 | 없음 |
| `ANTHROPIC_CUSTOM_HEADERS` | `Name: Value` (줄바꿈 구분) | API 요청에 추가할 커스텀 헤더 | 없음 |
| `ANTHROPIC_CUSTOM_MODEL_OPTION` | String (모델 ID) | `/model` 피커에 추가할 커스텀 모델 항목 | 없음 |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_NAME` | String | 커스텀 모델 표시명 | 모델 ID |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION` | String | 커스텀 모델 설명 | `Custom model (<model-id>)` |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES` | String | 커스텀 모델 지원 기능 | 없음 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | String (모델 ID) | 기본 Sonnet 모델 재정의 | 없음 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL_NAME` | String | Sonnet 모델 표시명 | 없음 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION` | String | Sonnet 모델 설명 | 없음 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES` | String | Sonnet 모델 지원 기능 | 없음 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | String (모델 ID) | 기본 Opus 모델 재정의 | 없음 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` | String | Opus 모델 표시명 | 없음 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION` | String | Opus 모델 설명 | 없음 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES` | String | Opus 모델 지원 기능 | 없음 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | String (모델 ID) | 기본 Haiku 모델 재정의 | 없음 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME` | String | Haiku 모델 표시명 | 없음 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION` | String | Haiku 모델 설명 | 없음 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES` | String | Haiku 모델 지원 기능 | 없음 |
| `ANTHROPIC_SMALL_FAST_MODEL` | String (모델 ID) | **DEPRECATED** — 백그라운드 태스크용 Haiku급 모델 | 없음 |
| `MAX_THINKING_TOKENS` | Integer | 확장 사고(extended thinking) 토큰 예산 | 모델 기본값 |
| `CLAUDE_CODE_EFFORT_LEVEL` | `low`, `medium`, `high`, `xhigh`, `max`, `auto` | 지원 모델의 effort 레벨 | 모델 기본값 |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Integer | 응답당 최대 출력 토큰 수 | 모델 기본값 |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | Integer | 컨텍스트 윈도우 크기 재정의 | 없음 |
| `CLAUDE_CODE_EXTRA_BODY` | JSON object | API 요청 바디에 병합할 추가 필드 | 없음 |
| `CLAUDE_CODE_DISABLE_1M_CONTEXT` | `0` or `1` | 1M 컨텍스트 창 지원 비활성화 | `0` |
| `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` | `0` or `1` | Opus/Sonnet 4.6+의 적응형 추론 비활성화 | `0` |
| `CLAUDE_CODE_DISABLE_THINKING` | `0` or `1` | 확장 사고(extended thinking) 강제 비활성화 | `0` |
| `CLAUDE_CODE_DISABLE_LEGACY_MODEL_REMAP` | `0` or `1` | Opus 4.0/4.1을 현재 버전으로 리매핑 방지 | `0` |
| `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` | Integer | 파일 읽기 토큰 한도 재정의 | 없음 |
| `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY` | `0` or `1` | 게이트웨이에서 `/model` 피커 목록 구성 | `0` |
| `CLAUDE_CODE_ENABLE_OPUS_4_7_FAST_MODE` | `0` or `1` | fast mode를 Opus 4.6 대신 4.7로 실행 | `0` |
| `CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE` | `0` or `1` | Opus 4.6에서 fast mode 유지 | `0` |
| `CLAUDE_CODE_DISABLE_FAST_MODE` | `0` or `1` | fast mode 비활성화 | `0` |
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` | `0` or `1` | 요청에서 `anthropic-beta` 헤더 제거 | `0` |
| `CLAUDE_CODE_ATTRIBUTION_HEADER` | `0` or `1` | 시스템 프롬프트에 어트리뷰션 블록 포함 | `1` |

---

### 타임아웃·성능·한도

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `API_TIMEOUT_MS` | Integer (ms) | API 요청 타임아웃 | `600000` (10분) |
| `BASH_DEFAULT_TIMEOUT_MS` | Integer (ms) | 장시간 bash 커맨드 기본 타임아웃 | `120000` (2분) |
| `BASH_MAX_TIMEOUT_MS` | Integer (ms) | bash 커맨드 최대 타임아웃 | `600000` (10분) |
| `BASH_MAX_OUTPUT_LENGTH` | Integer (chars) | 파일 저장 전 bash 출력 최대 문자 수 | 없음 |
| `CLAUDE_CODE_MAX_RETRIES` | Integer | 실패한 API 요청 재시도 횟수 | `10` |
| `CLAUDE_CODE_MAX_TURNS` | Integer | 에이전트 턴 상한 (플래그 미사용 시) | 없음 |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | Integer | 병렬 읽기 전용 도구/서브에이전트 최대 수 | `10` |
| `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS` | Integer (ms) | 백그라운드 서브에이전트 정체 타임아웃 | `600000` (10분) |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | Integer (1-100) | 자동 압축 트리거 컨텍스트 용량 비율 | ~95% |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | Integer (tokens) | 자동 압축 계산용 컨텍스트 용량 | 모델 컨텍스트 창 |
| `CLAUDE_CODE_GLOB_TIMEOUT_SECONDS` | Integer (s) | Glob 파일 탐색 타임아웃 | `20` (WSL: `60`) |
| `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` | Integer (ms) | SessionEnd 훅 시간 예산 | 1.5~60초 |
| `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` | Integer (ms) | 플러그인 git 작업 타임아웃 | `120000` |
| `CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS` | Integer (ms) | OpenTelemetry 스팬 플러시 타임아웃 | `5000` |
| `CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS` | Integer (ms) | OTel 익스포터 종료 타임아웃 | `2000` |
| `CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS` | Integer (ms) | 동적 OTel 헤더 갱신 주기 | `1740000` (29분) |
| `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` | Integer (ms) | 자격증명 갱신 주기 | 없음 |
| `CLAUDE_CODE_EXIT_AFTER_STOP_DELAY` | Integer (ms) | 자동 종료 전 대기 시간 | 없음 |

---

### MCP

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `CLAUDE_CODE_MCP_ALLOWLIST_ENV` | `0` or `1` | MCP 서버를 안전한 기본 환경으로 스폰 | `0` |
| `CLAUDE_AGENT_SDK_MCP_NO_PREFIX` | `0` or `1` | 도구명에서 `mcp__<server>__` 접두사 생략 (SDK 전용) | `0` |
| `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS` | `0` or `1` | 내장 서브에이전트 유형 비활성화 (SDK 전용) | `0` |

---

### Amazon Bedrock

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `CLAUDE_CODE_USE_BEDROCK` | `1` | Amazon Bedrock 사용 활성화 | 없음 |
| `ANTHROPIC_BEDROCK_BASE_URL` | URL | Bedrock 엔드포인트 재정의 | 없음 |
| `ANTHROPIC_BEDROCK_MANTLE_BASE_URL` | URL | Bedrock Mantle 엔드포인트 재정의 | 없음 |
| `ANTHROPIC_BEDROCK_SERVICE_TIER` | `default`, `flex`, `priority` | Bedrock 서비스 티어 (헤더로 전송) | 없음 |
| `AWS_BEARER_TOKEN_BEDROCK` | String | Bedrock 인증용 API 키 | 없음 |
| `ANTHROPIC_AWS_API_KEY` | String | AWS Claude Platform 워크스페이스 API 키 | 없음 |
| `ANTHROPIC_AWS_WORKSPACE_ID` | String | AWS Claude Platform 워크스페이스 ID (헤더로 전송) | 없음 |
| `ANTHROPIC_AWS_BASE_URL` | URL | AWS Claude Platform 엔드포인트 재정의 | `https://aws-external-anthropic.{AWS_REGION}.api.aws` |
| `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION` | String | Bedrock Haiku 모델 AWS 리전 | 없음 |

---

### Google Vertex AI

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `CLAUDE_CODE_USE_VERTEX` | `1` | Google Vertex AI 사용 활성화 | 없음 |
| `ANTHROPIC_VERTEX_PROJECT_ID` | String (GCP 프로젝트 ID) | Vertex AI용 GCP 프로젝트 ID. `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, 자격증명 파일에 의해 재정의됨 | 없음 |
| `ANTHROPIC_VERTEX_BASE_URL` | URL | Vertex AI 엔드포인트 재정의 | 없음 |

---

### Microsoft Azure AI Foundry

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `ANTHROPIC_FOUNDRY_BASE_URL` | URL | Foundry 리소스 전체 기본 URL (예: `https://my-resource.services.ai.azure.com/anthropic`) | 없음 |
| `ANTHROPIC_FOUNDRY_API_KEY` | String | Foundry 인증용 API 키 | 없음 |
| `ANTHROPIC_FOUNDRY_RESOURCE` | String | Foundry 리소스명 (예: `my-resource`) | 없음 |

---

### 디버그·개발·텔레메트리

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `CLAUDE_CODE_DEBUG_LOGS_DIR` | 파일 경로 | 디버그 로그 파일 경로 재정의 | `~/.claude/debug/<session-id>.txt` |
| `CLAUDE_CODE_DEBUG_LOG_LEVEL` | `verbose`, `debug`, `info`, `warn`, `error` | 디버그 로그 최소 레벨 | `debug` |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | `0` or `1` | OpenTelemetry 데이터 수집 활성화 | `0` |
| `CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL` | `0` or `1` | 설문 결과를 OTel 컬렉터로 라우팅 | `0` |
| `DISABLE_TELEMETRY` | `0` or `1` | 텔레메트리 비활성화 | `0` |
| `DO_NOT_TRACK` | `0` or `1` | 표준 DNT 신호 — 텔레메트리 비활성화 | `0` |
| `DISABLE_ERROR_REPORTING` | `0` or `1` | 오류 리포팅 비활성화 | `0` |
| `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` | `0` or `1` | 세션 품질 설문 비활성화 | `0` |
| `DISABLE_FEEDBACK_COMMAND` | `0` or `1` | `/feedback` 커맨드 비활성화 | `0` |
| `CLAUDE_CODE_SCRIPT_CAPS` | JSON object | 세션당 스크립트 호출 횟수 제한 | 없음 |

---

### 네트워크·TLS

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `CLAUDE_CODE_CERT_STORE` | `bundled`, `system`, 또는 쉼표 구분 | TLS용 CA 인증서 소스 | `bundled,system` |
| `CLAUDE_CODE_CLIENT_CERT` | 파일 경로 | mTLS 클라이언트 인증서 | 없음 |
| `CLAUDE_CODE_CLIENT_KEY` | 파일 경로 | mTLS 클라이언트 개인키 | 없음 |
| `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE` | String | 암호화된 클라이언트 키 패스프레이즈 | 없음 |
| `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` | `0` or `1` | 프록시가 DNS 해석 수행 허용 | `0` |

---

### UI·렌더링

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `CLAUDE_CODE_NO_FLICKER` | `0` or `1` | 전체화면 렌더러 활성화 (리서치 프리뷰) | `0` |
| `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` | `0` or `1` | 전체화면 렌더링 비활성화 | `0` |
| `CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL` | `0` or `1` | 전체화면 가상 스크롤 비활성화 | `0` |
| `CLAUDE_CODE_DISABLE_MOUSE` | `0` or `1` | 전체화면 마우스 트래킹 비활성화 | `0` |
| `CLAUDE_CODE_SCROLL_SPEED` | Integer (1-20) | 전체화면 마우스 휠 스크롤 배율 | 없음 |
| `CLAUDE_CODE_ACCESSIBILITY` | `0` or `1` | 네이티브 터미널 커서 표시 유지 | `0` |
| `CLAUDE_CODE_NATIVE_CURSOR` | `0` or `1` | 터미널 고유 커서 표시 | `0` |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` | `0` or `1` | 터미널 제목 업데이트 비활성화 | `0` |
| `CLAUDE_CODE_HIDE_CWD` | `0` or `1` | 시작 로고에서 작업 디렉토리 숨김 | `0` |
| `CLAUDE_CODE_FORCE_SYNC_OUTPUT` | `0` or `1` | DEC private mode 2026 동기화 출력 강제 | `0` |
| `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION` | `true` or `false` | 프롬프트 제안 기능 활성화 | `true` |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | `0` or `1` | 여러 `DISABLE_*` 변수 동시 적용 | `0` |

---

### 플러그인·IDE

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `CLAUDE_CODE_PLUGIN_CACHE_DIR` | 디렉토리 경로 | 플러그인 루트 디렉토리 재정의 | `~/.claude/plugins` |
| `CLAUDE_CODE_PLUGIN_SEED_DIR` | 경로 (`:` 또는 `;` 구분) | 읽기 전용 플러그인 시드 디렉토리 | 없음 |
| `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` | `0` or `1` | SSH 대신 HTTPS로 플러그인 클론 | `0` |
| `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` | `0` or `1` | git pull 실패 시 마켓플레이스 캐시 유지 | `0` |
| `CLAUDE_CODE_DISABLE_POLICY_SKILLS` | `0` or `1` | 시스템 전체 관리형 스킬 로드 스킵 | `0` |
| `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL` | `0` or `1` | 공식 마켓플레이스 자동 추가 스킵 | `0` |
| `CLAUDE_CODE_ENABLE_BACKGROUND_PLUGIN_REFRESH` | `0` or `1` | 백그라운드 설치 후 플러그인 상태 갱신 | `0` |
| `CLAUDE_CODE_IDE_HOST_OVERRIDE` | String (호스트 주소) | IDE 연결 호스트 재정의 | 자동 감지 |
| `CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL` | `0` or `1` | IDE 확장 자동 설치 스킵 | `0` |
| `CLAUDE_CODE_IDE_SKIP_VALID_CHECK` | `0` or `1` | IDE 잠금 파일 유효성 검사 스킵 | `0` |
| `CLAUDE_CODE_AUTO_CONNECT_IDE` | `true` or `false` | 외부 터미널에서 IDE 자동 연결 | 자동 감지 |

---

### 기타·시스템

| 변수 | 타입/예시값 | 설명 | 기본값 |
|------|-------------|------|--------|
| `CLAUDECODE` | `1` | Claude Code가 생성한 셸에서 자동 설정. 읽기 전용 | 설정 안 됨 |
| `CLAUDE_CODE_SESSION_ID` | String | 현재 세션 ID. 스폰된 셸에서 자동 설정. 읽기 전용 | 설정 안 됨 |
| `CLAUDE_CODE_REMOTE` | `true` or `false` | 클라우드 세션에서 자동 설정 | 설정 안 됨 |
| `CLAUDE_CODE_REMOTE_SESSION_ID` | String | 클라우드 세션 ID. 자동 설정 | 설정 안 됨 |
| `CLAUDE_CODE_SIMPLE` | — | `--bare` 플래그 사용 시 자동 설정 | 설정 안 됨 |
| `CLAUDE_CODE_GIT_BASH_PATH` | 파일 경로 | Windows: Git Bash 실행 파일 경로 | 자동 감지 |
| `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` | String | 호스트 플랫폼이 프로바이더 라우팅을 관리할 때 설정 | 없음 |
| `CLAUDE_CODE_SKIP_PROMPT_HISTORY` | `0` or `1` | 모든 모드에서 세션을 디스크에 저장하지 않음 | 없음 |
| `DISABLE_AUTOUPDATER` | `0` or `1` | 자동 업데이트 체크 비활성화 (`CLAUDE_CODE_DISABLE_AUTOUPDATER`도 동일) | `0` |
| `DISABLE_UPDATES` | — | 수동 업데이트 포함 모든 업데이트 경로 차단 | 없음 |
| `USE_BUILTIN_RIPGREP` | `0` or `1` | 내장 ripgrep 사용. musl 시스템(Alpine 등)에서 `0` 설정 | `1` |
| `CCR_FORCE_BUNDLE` | `0` or `1` | `claude --remote` 시 로컬 레포를 강제 번들 | `0` |
| `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | `0` or `1` | bash 커맨드 후 원래 디렉토리로 복귀 | `0` |
| `CLAUDE_CODE_PERFORCE_MODE` | `0` or `1` | Perforce 인식 쓰기 보호 활성화 | `0` |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | `0` or `1` | CLAUDE.md 메모리 파일 로드 방지 | `0` |
| `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` | `0` or `1` | 시스템 프롬프트에서 git 워크플로우 지시문 제거 | `0` |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | `0` or `1` | 자동 메모리 읽기/쓰기 비활성화 (`0`=강제 활성화) | `0` |
| `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` | `0` or `1` | `--add-dir` 디렉토리에서 메모리 파일 로드 | `0` |
| `CLAUDE_CODE_DISABLE_AGENT_VIEW` | `0` or `1` | 백그라운드 에이전트 및 에이전트 뷰 비활성화 | `0` |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | `0` or `1` | 모든 백그라운드 태스크 기능 비활성화 | `0` |
| `CLAUDE_CODE_DISABLE_CRON` | `0` or `1` | 예약 태스크 비활성화 | `0` |
| `CLAUDE_CODE_DISABLE_ATTACHMENTS` | `0` or `1` | 첨부 파일 처리 비활성화 | `0` |
| `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING` | `0` or `1` | `/rewind`용 파일 체크포인팅 비활성화 | `0` |
| `CLAUDE_CODE_RESUME_INTERRUPTED_TURN` | `0` or `1` | 턴 중간에 세션 종료 시 자동 재개 | `0` |
| `CLAUDE_CODE_RESUME_PROMPT` | String | 재개 메시지 재정의 | `Continue from where you left off.` |
| `CLAUDE_CODE_ENABLE_AWAY_SUMMARY` | `0` or `1` | 자리비움 후 세션 요약 표시 활성화 | 설정 의존 |
| `CLAUDE_CODE_ENABLE_TASKS` | `0` or `1` | 비대화형 모드에서 태스크 추적 활성화 | `0` |
| `CLAUDE_CODE_AUTO_BACKGROUND_TASKS` | `0` or `1` | 자동 백그라운드 전환 강제 활성화 | `0` |
| `CLAUDE_CODE_FORK_SUBAGENT` | `0` or `1` | 포크된 서브에이전트 활성화 | `0` |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `0` or `1` | 에이전트 팀 실험적 기능 활성화 | `0` |
| `CLAUDE_CODE_GLOB_HIDDEN` | `true` or `false` | Glob 결과에 dotfile 포함 | `true` |
| `CLAUDE_CODE_GLOB_NO_IGNORE` | `true` or `false` | Glob이 `.gitignore` 무시하게 설정 (true = 무시 안 함) | `false` |
| `CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING` | `0` or `1` | API로부터 도구 입력 스트리밍 활성화 | 프로바이더 의존 |
| `CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE` | `0` or `1` | 패키지 매니저 자동 업그레이드 실행 | `0` |
| `CLAUDE_CODE_NEW_INIT` | `0` or `1` | `/init` 명령이 인터랙티브 설정 플로우 실행 | `0` |
| `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK` | `0` or `1` | 오류 발생 시 논스트리밍 폴백 비활성화 | `0` |
| `CLAUDE_CODE_USE_POWERSHELL_TOOL` | `1` | PowerShell 도구 활성화 (인터랙티브 커맨드용) | 없음 |
| `CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX` | String | Remote Control 세션 이름 자동 생성 시 접두사 | 호스트명 |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | Integer (tokens) | 자동 압축 계산용 컨텍스트 용량 | 모델 컨텍스트 창 |

---

## OpenTelemetry (OTEL)

환경변수 외에 OTEL 표준 변수도 지원:

| 변수 | 타입/예시값 | 설명 |
|------|-------------|------|
| `OTEL_METRICS_EXPORTER` | `otlp` | OTel 메트릭 익스포터 설정 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | URL | OTLP 엔드포인트 |
| `OTEL_EXPORTER_OTLP_HEADERS` | String | OTLP 헤더 |

`CLAUDE_CODE_ENABLE_TELEMETRY=1`과 함께 사용. `settings.json` `env` 키로 팀 배포 가능.

---

## 참고

- 공식 env-vars: https://code.claude.com/docs/en/env-vars
- 공식 settings: https://code.claude.com/docs/en/settings
- 공식 CLI reference: https://code.claude.com/docs/en/cli-reference
- 관련 챕터: `chapters/02-config.md`

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/MyLittleLuckyDog/cc-gnothi</sub>
