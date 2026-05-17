---
type: reference
source: https://code.claude.com/docs/en/cli-reference
updated: 2026-05-17
stale_risk: high  # 공식 문서 기반. bundle 분석과 충돌 시 bundle 우선.
---

# Claude Code CLI Reference

## CLI 커맨드

세션 시작, 콘텐츠 파이프, 대화 재개, 업데이트 관리를 위한 최상위 커맨드.

| 커맨드 | 설명 | 예시 |
|--------|------|------|
| `claude` | 인터랙티브 세션 시작 | `claude` |
| `claude "query"` | 초기 프롬프트와 함께 세션 시작 | `claude "explain this project"` |
| `claude -p "query"` | SDK 방식으로 쿼리 후 종료 | `claude -p "explain this function"` |
| `cat file \| claude -p "query"` | 파이프 입력 처리 | `cat logs.txt \| claude -p "explain"` |
| `claude -c` | 현재 디렉토리의 최근 대화 이어가기 | `claude -c` |
| `claude -c -p "query"` | SDK 방식으로 대화 이어가기 | `claude -c -p "Check for type errors"` |
| `claude -r "<session>" "query"` | ID 또는 이름으로 세션 재개 | `claude -r "auth-refactor" "Finish this PR"` |
| `claude update` | 최신 버전으로 업데이트 | `claude update` |
| `claude install [version]` | 네이티브 바이너리 설치/재설치. `2.1.118`, `stable`, `latest` 수락 | `claude install stable` |
| `claude auth login` | Anthropic 계정 로그인. `--email`, `--sso`, `--console` 옵션 지원 | `claude auth login --console` |
| `claude auth logout` | 계정 로그아웃 | `claude auth logout` |
| `claude auth status` | 인증 상태를 JSON으로 출력. `--text`로 가독성 있는 출력. 로그인 시 0, 미로그인 시 1로 종료 | `claude auth status` |
| `claude agents` | 병렬 백그라운드 세션 모니터링/디스패치용 에이전트 뷰 열기 | `claude agents` |
| `claude attach <id>` | 이 터미널에서 백그라운드 세션에 연결 | `claude attach 7c5dcf5d` |
| `claude auto-mode defaults` | 내장 auto mode 분류자 규칙을 JSON으로 출력 | `claude auto-mode defaults > rules.json` |
| `claude logs <id>` | 백그라운드 세션의 최근 출력 출력 | `claude logs 7c5dcf5d` |
| `claude mcp` | MCP 서버 구성 | — |
| `claude plugin` | 플러그인 관리 (별칭: `claude plugins`) | `claude plugin install code-review@claude-plugins-official` |
| `claude project purge [path]` | 프로젝트의 모든 로컬 상태 삭제. `--dry-run`, `-y`, `-i`, `--all` 플래그 지원 | `claude project purge ~/work/repo --dry-run` |
| `claude remote-control` | claude.ai에서 제어 가능한 Remote Control 서버 시작 | `claude remote-control --name "My Project"` |
| `claude respawn <id>` | 중단된 백그라운드 세션 대화 유지하며 재시작. `--all`로 전체 재시작 | `claude respawn 7c5dcf5d` |
| `claude rm <id>` | 백그라운드 세션 목록에서 제거 | `claude rm 7c5dcf5d` |
| `claude setup-token` | CI/스크립트용 장기 OAuth 토큰 생성. Claude 구독 필요 | `claude setup-token` |
| `claude stop <id>` | 백그라운드 세션 중지 (별칭: `claude kill`) | `claude stop 7c5dcf5d` |
| `claude ultrareview [target]` | 비대화형으로 ultrareview 실행. `--json`, `--timeout <minutes>` 지원 | `claude ultrareview 1234 --json` |

---

## CLI 플래그

`claude --help`에 없는 플래그도 사용 가능.

| 플래그 | 단축 | 설명 | 예시 |
|--------|------|------|------|
| `--add-dir` | — | 추가 작업 디렉토리 지정. 파일 접근 권한 부여 | `claude --add-dir ../apps ../lib` |
| `--agent` | — | 현재 세션에서 사용할 에이전트 지정 | `claude --agent my-custom-agent` |
| `--agents` | — | JSON으로 커스텀 서브에이전트를 동적으로 정의 | `claude --agents '{"reviewer":{"prompt":"..."}}` |
| `--allow-dangerously-skip-permissions` | — | `bypassPermissions`를 Shift+Tab 사이클에 추가 (시작 모드로 설정하지 않음) | — |
| `--allowedTools` | — | 권한 확인 없이 실행할 도구 패턴 지정 | `"Bash(git log *)" "Read"` |
| `--append-system-prompt` | — | 기본 시스템 프롬프트 뒤에 텍스트 추가 | `claude --append-system-prompt "Always use TypeScript"` |
| `--append-system-prompt-file` | — | 파일에서 시스템 프롬프트 추가 텍스트 로드 | `claude --append-system-prompt-file ./extra-rules.txt` |
| `--bare` | — | 최소 모드: 훅/스킬/플러그인/MCP/CLAUDE.md 자동 검색 생략. `CLAUDE_CODE_SIMPLE` 설정 | `claude --bare -p "query"` |
| `--betas` | — | API 요청에 포함할 베타 헤더 (API 키 사용자 전용) | `claude --betas interleaved-thinking` |
| `--bg` | — | 백그라운드 에이전트로 세션 시작 후 즉시 반환. 세션 ID 출력 | `claude --bg "investigate the flaky test"` |
| `--channels` | — | 이 세션에서 수신할 MCP 서버 채널 (공백 구분) | — |
| `--chrome` | — | Chrome 브라우저 통합 활성화 | `claude --chrome` |
| `--continue` | `-c` | 현재 디렉토리의 최근 대화 로드 | `claude --continue` |
| `--dangerously-skip-permissions` | — | 권한 프롬프트 생략. `--permission-mode bypassPermissions`와 동일 | `claude --dangerously-skip-permissions` |
| `--debug` | — | 디버그 모드 활성화. 선택적 카테고리 필터링 지원 | `claude --debug "api,mcp"` |
| `--debug-file <path>` | — | 특정 파일 경로에 디버그 로그 기록 | `claude --debug-file /tmp/claude-debug.log` |
| `--disable-slash-commands` | — | 이 세션의 모든 스킬과 커맨드 비활성화 | — |
| `--disallowedTools` | — | 모델 컨텍스트에서 제거하여 사용 불가능하게 할 도구 | `"Bash(git log *)" "Edit"` |
| `--effort` | — | 세션의 effort 레벨 설정. `low`, `medium`, `high`, `xhigh`, `max` | `claude --effort high` |
| `--exclude-dynamic-system-prompt-sections` | — | 머신별 시스템 프롬프트 섹션을 첫 번째 사용자 메시지로 이동. 프롬프트 캐시 재사용 향상 | — |
| `--fallback-model` | — | 기본 모델 과부하 시 자동 대체 모델 (print mode 전용) | `claude -p --fallback-model sonnet "query"` |
| `--fork-session` | — | 재개 시 원본 재사용 대신 새 세션 ID 생성 | `claude --resume abc123 --fork-session` |
| `--from-pr` | — | 특정 PR에 연결된 세션 재개. PR 번호, GitHub/GitLab/Bitbucket URL 수락 | `claude --from-pr 123` |
| `--ide` | — | 시작 시 유효한 IDE 하나만 있으면 자동 연결 | `claude --ide` |
| `--init` | — | 세션 전 `init` 매처로 Setup 훅 실행 (print mode 전용) | `claude -p --init "query"` |
| `--init-only` | — | Setup과 SessionStart 훅 실행 후 대화 시작 없이 종료 | `claude --init-only` |
| `--include-hook-events` | — | 출력 스트림에 모든 훅 이벤트 포함. `--output-format stream-json` 필요 | — |
| `--include-partial-messages` | — | 출력에 부분 스트리밍 이벤트 포함. `--print`와 `stream-json` 필요 | — |
| `--input-format` | — | print mode 입력 형식 지정. `text`, `stream-json` | — |
| `--json-schema` | — | 에이전트 완료 후 JSON Schema에 맞는 검증된 JSON 출력 (print mode 전용) | — |
| `--maintenance` | — | 세션 전 `maintenance` 매처로 Setup 훅 실행 (print mode 전용) | — |
| `--max-budget-usd` | — | API 호출에 소비할 최대 달러 금액 (print mode 전용) | `claude -p --max-budget-usd 5.00 "query"` |
| `--max-turns` | — | 에이전트 턴 수 제한 (print mode 전용). 기본값: 무제한 | `claude -p --max-turns 3 "query"` |
| `--mcp-config` | — | JSON 파일이나 문자열에서 MCP 서버 로드 | `claude --mcp-config ./mcp.json` |
| `--model` | — | 세션 모델 설정. `sonnet`, `opus` 별칭 또는 전체 모델명. `ANTHROPIC_MODEL` 재정의 | `claude --model claude-sonnet-4-6` |
| `--name` | `-n` | 세션 표시 이름 설정. `/resume`과 터미널 제목에 표시 | `claude -n "my-feature-work"` |
| `--no-chrome` | — | 이 세션에서 Chrome 통합 비활성화 | `claude --no-chrome` |
| `--no-session-persistence` | — | 세션을 디스크에 저장하지 않음 (print mode 전용) | `claude -p --no-session-persistence "query"` |
| `--output-format` | — | print mode 출력 형식. `text`, `json`, `stream-json` | `claude -p "query" --output-format json` |
| `--permission-mode` | — | 시작 권한 모드 지정. `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` | `claude --permission-mode plan` |
| `--permission-prompt-tool` | — | 비대화형 모드에서 권한 프롬프트를 처리할 MCP 도구 지정 | — |
| `--plugin-dir` | — | 이 세션에서만 디렉토리나 `.zip`에서 플러그인 로드 | `claude --plugin-dir ./my-plugin` |
| `--plugin-url` | — | URL에서 플러그인 `.zip` 아카이브 가져오기 | `claude --plugin-url https://example.com/plugin.zip` |
| `--print` | `-p` | 인터랙티브 모드 없이 응답 출력 | `claude -p "query"` |
| `--remote` | — | claude.ai에 새 웹 세션 생성 | `claude --remote "Fix the login bug"` |
| `--remote-control` | `--rc` | Remote Control 활성화된 인터랙티브 세션 시작 | `claude --remote-control "My Project"` |
| `--remote-control-session-name-prefix <prefix>` | — | Remote Control 세션 이름 자동 생성 시 접두사. 기본값: 호스트명 | — |
| `--resume` | `-r` | ID나 이름으로 특정 세션 재개 또는 인터랙티브 선택기 표시 | `claude --resume auth-refactor` |
| `--session-id` | — | 대화에 사용할 세션 ID 지정 (유효한 UUID여야 함) | — |
| `--setting-sources` | — | 로드할 설정 소스 지정. `user`, `project`, `local` | `claude --setting-sources user,project` |
| `--settings` | — | 설정 JSON 파일 경로 또는 인라인 JSON 문자열. 이 세션의 `settings.json`을 재정의 | `claude --settings ./settings.json` |
| `--strict-mcp-config` | — | `--mcp-config`의 MCP 서버만 사용하고 다른 구성 무시 | `claude --strict-mcp-config --mcp-config ./mcp.json` |
| `--system-prompt` | — | 전체 시스템 프롬프트를 커스텀 텍스트로 교체 | `claude --system-prompt "You are a Python expert"` |
| `--system-prompt-file` | — | 파일에서 시스템 프롬프트 로드하여 기본 프롬프트 교체 | `claude --system-prompt-file ./custom-prompt.txt` |
| `--teleport` | — | 웹 세션을 로컬 터미널로 재개 | `claude --teleport` |
| `--teammate-mode` | — | 팀메이트 표시 방식. `auto`(기본), `in-process`, `tmux` | `claude --teammate-mode in-process` |
| `--tmux` | — | 워크트리에 tmux 세션 생성. `--worktree` 필요. `--tmux=classic`으로 전통적 tmux | `claude -w feature-auth --tmux` |
| `--tools` | — | Claude가 사용할 내장 도구 제한. `""` 전체 비활성화, `"default"` 전체 허용 | `claude --tools "Bash,Edit,Read"` |
| `--verbose` | — | 상세 로깅 활성화, 턴별 전체 출력 표시 | `claude --verbose` |
| `--version` | `-v` | 버전 번호 출력 | `claude -v` |
| `--worktree` | `-w` | 격리된 git worktree에서 Claude 시작 | `claude -w feature-auth` |

### 시스템 프롬프트 플래그 요약

| 플래그 | 동작 |
|--------|------|
| `--system-prompt` | 기본 프롬프트 전체 교체 |
| `--system-prompt-file` | 파일 내용으로 전체 교체 |
| `--append-system-prompt` | 기본 프롬프트에 추가 |
| `--append-system-prompt-file` | 파일 내용을 기본 프롬프트에 추가 |

- `--system-prompt`와 `--system-prompt-file`은 상호 배타적
- append 플래그는 교체 플래그와 조합 가능

---

## 슬래시 커맨드

세션 내부에서 사용. `/`로 시작하는 커맨드. `[Skill]` 표시는 번들 스킬(프롬프트 기반).

| 커맨드 | 설명 | 비고 |
|--------|------|------|
| `/add-dir <path>` | 현재 세션에 작업 디렉토리 추가 | — |
| `/agents` | 에이전트 구성 관리 | — |
| `/autofix-pr [prompt]` | PR의 CI 실패/리뷰 댓글 자동 수정하는 원격 세션 생성 | `gh` CLI 필요 |
| `/background [prompt]` | 현재 세션을 백그라운드 에이전트로 분리. 별칭: `/bg` | — |
| `/batch <instruction>` | **[Skill]** 코드베이스 대규모 변경을 5~30개 병렬 단위로 분해하여 실행 | git 저장소 필요 |
| `/branch [name]` | 현재 대화의 브랜치 생성. 별칭: `/fork` | — |
| `/btw <question>` | 대화 히스토리에 추가되지 않는 빠른 사이드 질문 | — |
| `/chrome` | Claude in Chrome 설정 | — |
| `/claude-api [migrate\|managed-agents-onboard]` | **[Skill]** Claude API 참조 자료 로드. `migrate`로 코드 마이그레이션 | — |
| `/clear [name]` | 새 대화 시작 (이전 대화 유지). 별칭: `/reset`, `/new` | — |
| `/color [color\|default]` | 현재 세션 프롬프트 바 색상 설정 | — |
| `/compact [instructions]` | 대화 요약으로 컨텍스트 확보 | — |
| `/config` | 설정 인터페이스 열기. 별칭: `/settings` | — |
| `/context [all]` | 현재 컨텍스트 사용량 시각화 | — |
| `/copy [N]` | 마지막 응답을 클립보드에 복사. N으로 N번째 최신 응답 선택 | — |
| `/cost` | `/usage`의 별칭 | — |
| `/debug [description]` | **[Skill]** 현재 세션 디버그 로깅 활성화 및 문제 분석 | — |
| `/desktop` | Claude Code 데스크톱 앱에서 세션 계속. 별칭: `/app` | macOS/Windows |
| `/diff` | 미커밋 변경사항과 턴별 diff 인터랙티브 뷰어 | — |
| `/doctor` | Claude Code 설치 및 설정 진단 | — |
| `/effort [level\|auto]` | 모델 effort 레벨 설정 | — |
| `/exit` | CLI 종료. 별칭: `/quit` | — |
| `/export [filename]` | 현재 대화를 일반 텍스트로 내보내기 | — |
| `/extra-usage` | 속도 제한 초과 시 추가 사용량 구성 | — |
| `/fast [on\|off]` | fast mode 토글 | — |
| `/feedback [report]` | 피드백 제출. 별칭: `/bug` | — |
| `/fewer-permission-prompts` | **[Skill]** 트랜스크립트 분석하여 허용 목록 추가, 권한 프롬프트 감소 | — |
| `/focus` | 마지막 프롬프트와 최종 응답만 표시하는 포커스 뷰 토글 | 전체화면 모드 전용 |
| `/goal [condition\|clear]` | 조건 달성까지 Claude가 계속 작업하는 목표 설정 | — |
| `/heapdump` | JS 힙 스냅샷 및 메모리 분석 파일 작성 | — |
| `/help` | 도움말과 사용 가능한 커맨드 표시 | — |
| `/hooks` | 도구 이벤트의 훅 구성 보기 | — |
| `/ide` | IDE 통합 관리 및 상태 표시 | — |
| `/init` | `CLAUDE.md` 가이드로 프로젝트 초기화 | — |
| `/insights` | Claude Code 세션 분석 리포트 생성 | — |
| `/install-github-app` | Claude GitHub Actions 앱 설정 | — |
| `/install-slack-app` | Claude Slack 앱 설치 | — |
| `/keybindings` | 키바인딩 구성 파일 열기/생성 | — |
| `/login` | Anthropic 계정 로그인 | — |
| `/logout` | Anthropic 계정 로그아웃 | — |
| `/loop [interval] [prompt]` | **[Skill]** 세션 동안 프롬프트 반복 실행. 별칭: `/proactive` | — |
| `/mcp` | MCP 서버 연결 및 OAuth 인증 관리 | — |
| `/memory` | `CLAUDE.md` 파일 편집, auto-memory 설정 | — |
| `/mobile` | Claude 모바일 앱 QR 코드 표시. 별칭: `/ios`, `/android` | — |
| `/model [model]` | AI 모델 선택/변경 | — |
| `/passes` | 친구에게 Claude Code 무료 1주일 공유 | 계정 조건 필요 |
| `/permissions` | 도구 권한 허용/요청/거부 규칙 관리. 별칭: `/allowed-tools` | — |
| `/plan [description]` | 플랜 모드 진입 | — |
| `/plugin` | Claude Code 플러그인 관리 | — |
| `/powerup` | 인터랙티브 레슨으로 Claude Code 기능 발견 | — |
| `/privacy-settings` | 개인정보 설정 보기 및 업데이트 | Pro/Max 전용 |
| `/radio` | Claude FM lo-fi 라디오 브라우저에서 열기 | Bedrock/Vertex/Foundry 불가 |
| `/recap` | 현재 세션의 한 줄 요약 생성 | — |
| `/release-notes` | 변경 로그를 인터랙티브 버전 선택기에서 보기 | — |
| `/reload-plugins` | 재시작 없이 모든 활성 플러그인 리로드 | — |
| `/remote-control` | 이 세션을 claude.ai에서 원격 제어 가능하게 설정. 별칭: `/rc` | — |
| `/remote-env` | `--remote`로 시작한 웹 세션의 기본 원격 환경 구성 | — |
| `/rename [name]` | 현재 세션 이름 변경 | — |
| `/resume [session]` | ID나 이름으로 대화 재개. 별칭: `/continue` | — |
| `/review [PR]` | PR을 로컬에서 코드 리뷰 | — |
| `/rewind` | 이전 시점으로 대화/코드 되돌리기. 별칭: `/checkpoint`, `/undo` | — |
| `/sandbox` | 샌드박스 모드 토글 | 지원 플랫폼만 |
| `/schedule [description]` | 루틴(정기 예약 작업) 생성/관리. 별칭: `/routines` | — |
| `/scroll-speed` | 마우스 휠 스크롤 속도 조정 | 전체화면 모드만 |
| `/security-review` | 현재 브랜치 변경사항 보안 취약점 분석 | — |
| `/setup-bedrock` | Amazon Bedrock 인증/리전/모델 대화형 설정 | `CLAUDE_CODE_USE_BEDROCK=1` 필요 |
| `/setup-vertex` | Google Vertex AI 인증/프로젝트/리전 대화형 설정 | `CLAUDE_CODE_USE_VERTEX=1` 필요 |
| `/simplify [focus]` | **[Skill]** 최근 변경 파일의 코드 품질/효율성 검토 및 수정 | — |
| `/skills` | 사용 가능한 스킬 목록 표시 | — |
| `/stats` | `/usage`의 별칭 (Stats 탭) | — |
| `/status` | 설정 인터페이스 상태 탭 열기 (버전, 모델, 계정, 연결성) | — |
| `/statusline` | Claude Code 상태 줄 구성 | — |
| `/stop` | 현재 백그라운드 세션 중지 | 백그라운드 세션 연결 중만 |
| `/tasks` | 백그라운드 태스크 목록 및 관리. 별칭: `/bashes` | — |
| `/team-onboarding` | 과거 30일 세션으로 팀 온보딩 가이드 생성 | — |
| `/teleport` | 웹 세션을 이 터미널로 가져오기. 별칭: `/tp` | claude.ai 구독 필요 |
| `/terminal-setup` | Shift+Enter 등 터미널 키바인딩 구성 | 특정 터미널에서만 표시 |
| `/theme` | 색상 테마 변경 | — |
| `/tui [default\|fullscreen]` | 터미널 UI 렌더러 설정. `fullscreen`으로 플리커 없는 대체 화면 | — |
| `/ultraplan <prompt>` | ultraplan 세션에서 계획 작성 후 브라우저 검토 | — |
| `/ultrareview [PR]` | 클라우드 샌드박스에서 멀티 에이전트 심층 코드 리뷰 | Pro/Max: 3회 무료 |
| `/upgrade` | 상위 플랜으로 업그레이드 페이지 열기 | — |
| `/usage` | 세션 비용, 플랜 사용량, 활동 통계 표시. 별칭: `/cost`, `/stats` | — |
| `/voice [hold\|tap\|off]` | 음성 받아쓰기 토글 또는 특정 모드 활성화 | claude.ai 계정 필요 |
| `/web-setup` | 로컬 `gh` CLI 자격증명으로 GitHub 계정 연결 | — |

> MCP 서버는 `/mcp__<server>__<prompt>` 형식으로 커맨드를 노출할 수 있음.

---

## 주요 환경 변수

| 변수 | 설명 | 타입/기본값 |
|------|------|-------------|
| `ANTHROPIC_API_KEY` | API 키 (`X-Api-Key` 헤더) | String |
| `ANTHROPIC_AUTH_TOKEN` | 커스텀 Authorization 헤더 값 (`Bearer ` 접두사 자동 추가) | String |
| `ANTHROPIC_BASE_URL` | 프록시/게이트웨이 라우팅을 위한 API 엔드포인트 재정의 | String |
| `ANTHROPIC_MODEL` | 사용할 모델 설정 | String |
| `ANTHROPIC_BETAS` | `anthropic-beta` 헤더 값 (쉼표 구분) | String |
| `API_TIMEOUT_MS` | API 요청 타임아웃 | Integer; 기본값: `600000` (10분) |
| `BASH_DEFAULT_TIMEOUT_MS` | 장시간 bash 커맨드 기본 타임아웃 | Integer; 기본값: `120000` (2분) |
| `BASH_MAX_TIMEOUT_MS` | bash 커맨드 최대 타임아웃 | Integer; 기본값: `600000` (10분) |
| `BASH_MAX_OUTPUT_LENGTH` | bash 출력을 파일에 저장하기 전 최대 문자 수 | Integer |
| `CLAUDECODE` | Claude Code가 생성한 쉘 환경에서 설정됨 | `1` (읽기 전용) |
| `CLAUDE_CODE_DEBUG_LOGS_DIR` | 디버그 로그 파일 경로 재정의 | String; 기본값: `~/.claude/debug/<session-id>.txt` |
| `CLAUDE_CODE_DISABLE_AUTOUPDATER` | 백그라운드 자동 업데이트 비활성화 (`DISABLE_AUTOUPDATER`도 동일) | `0` or `1` |
| `CLAUDE_CODE_EFFORT_LEVEL` | 지원 모델의 effort 레벨 | `low`, `medium`, `high`, `xhigh`, `max`, `auto` |
| `CLAUDE_CODE_GIT_BASH_PATH` | Windows: Git Bash 실행 파일 경로 | String (파일 경로) |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | 컨텍스트 윈도우 크기 재정의 | Integer (토큰) |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | 최대 출력 토큰 수 | Integer |
| `CLAUDE_CODE_MAX_TURNS` | 에이전트 턴 수 상한 | 양의 정수 |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude.ai OAuth 액세스 토큰 | String |
| `CLAUDE_CODE_OAUTH_REFRESH_TOKEN` | Claude.ai OAuth 리프레시 토큰 | String |
| `CLAUDE_CODE_SESSION_ID` | 현재 세션 ID (서브프로세스에서 읽기 전용) | String |
| `CLAUDE_CODE_SKIP_PROMPT_HISTORY` | 어떤 모드에서든 세션을 디스크에 저장하지 않음 | — |
| `CLAUDE_CODE_USE_BEDROCK` | Amazon Bedrock 사용 활성화 | `1` |
| `CLAUDE_CODE_USE_VERTEX` | Google Vertex AI 사용 활성화 | `1` |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | 자동 압축 트리거 컨텍스트 용량 비율 | Integer: 1-100; 기본값: ~95% |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | OpenTelemetry 데이터 수집 활성화 | `0` or `1` |
| `DISABLE_AUTOUPDATER` | 백그라운드 업데이트 체크 중지 | `"1"` |
| `DISABLE_UPDATES` | 수동 업데이트 포함 모든 업데이트 경로 차단 | — |
| `USE_BUILTIN_RIPGREP` | 내장 ripgrep 사용 여부 (Alpine 등 musl 시스템에서 `0`으로 설정) | `0` or `1` |
| `ANTHROPIC_AWS_API_KEY` | AWS용 Claude Platform 워크스페이스 API 키 | String |
| `ANTHROPIC_AWS_WORKSPACE_ID` | AWS용 Claude Platform 워크스페이스 ID | String |
| `ANTHROPIC_VERTEX_PROJECT_ID` | Vertex AI용 GCP 프로젝트 ID | String |
| `ANTHROPIC_FOUNDRY_BASE_URL` | Foundry 리소스 전체 기본 URL | String |
