---
type: feature-spec
feature: "commands"
cc_version: "2.1.143"
updated: 2026-05-17
tags: ["commands", "slash-commands", "interactive", "skills", "mcp", "session", "workflow"]
related:
  - docs/chapters/01-concepts.md
  - docs/chapters/04-mcp.md
  - docs/chapters/05-skills.md
source: "official-docs-bootstrap"
bundle_verified: false
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
---

# 슬래시 커맨드

> 이 챕터: Interactive 세션 내에서 사용하는 `/command` 형태의 내장 커맨드 전체 참고.  
> CLI 시작 플래그(`--flag`)는 `chapters/02-config.md`에서 다룬다.  
> 최소 버전: v2.1.0

---

## 개념

### 슬래시 커맨드란

슬래시 커맨드는 **Interactive 모드 전용** 제어 인터페이스다. 메시지 첫 글자가 `/`일 때만 인식한다. 커맨드명 뒤에 오는 텍스트는 인수로 전달된다.

| 항목 | 설명 |
|---|---|
| 진입 방법 | `claude` (Interactive 모드) |
| 위치 | 메시지 맨 앞 |
| 목록 확인 | `/` 입력 후 자동완성, 또는 `/help` |
| 비활성화 | `--disable-slash-commands` 플래그로 세션 전체 비활성화 |

### Interactive 모드에서만 동작

`-p` (print/non-interactive) 모드, `--bare` 모드에서는 슬래시 커맨드를 사용할 수 없다. 자동화 파이프라인에서는 커맨드 동작을 프롬프트 텍스트에 직접 포함해야 한다.

```bash
# Interactive — /compact 사용 가능
claude

# Non-interactive — /compact 사용 불가. 직접 지시
claude -p "Summarize and compress the context, then continue with the task"
```

### 슬래시 커맨드 vs CLI 플래그

| 구분 | 예시 | 적용 시점 | 모드 |
|---|---|---|---|
| **슬래시 커맨드** | `/model`, `/compact` | 세션 실행 중 | Interactive 전용 |
| **CLI 플래그** | `--model`, `--bare` | 세션 시작 시 | 모든 모드 |

같은 기능이 두 형태로 존재하는 경우, CLI 플래그는 시작값을 고정하고 슬래시 커맨드는 세션 중 동적으로 변경한다.

### 커맨드 유형

| 유형 | 설명 | 예시 |
|---|---|---|
| **내장 커맨드** | CLI에 코딩된 동작 | `/clear`, `/mcp`, `/model` |
| **번들 스킬** | 프롬프트 기반, `[Skill]` 표시 | `/batch`, `/simplify`, `/debug` |
| **사용자 정의 스킬** | `.claude/skills/<name>/SKILL.md` | `/<skill-name>` |
| **MCP 프롬프트** | 연결된 MCP 서버가 노출 | `/mcp__<server>__<prompt>` |

---

## 패턴

### 1. 세션 관리

| 커맨드 | 기능 | 별칭/비고 |
|---|---|---|
| `/clear [name]` | 새 대화 시작. 이전 대화는 `/resume`에 보존 | `/reset`, `/new` |
| `/compact [instructions]` | 대화 요약으로 컨텍스트 확보. 같은 대화 유지 | — |
| `/context [all]` | 컨텍스트 사용량 시각화. `all`로 세부 확장 | — |
| `/resume [session]` | ID·이름으로 이전 대화 재개. 인수 없으면 선택기 표시 | `/continue` |
| `/branch [name]` | 현재 대화 분기. 원본은 `/resume`으로 복귀 가능 | `/fork` |
| `/rewind` | 대화·코드를 이전 체크포인트로 되돌리기 | `/checkpoint`, `/undo` |
| `/rename [name]` | 현재 세션 이름 변경. 인수 없으면 자동 생성 | — |
| `/export [filename]` | 대화를 일반 텍스트로 내보내기 | — |
| `/recap` | 현재 세션 한 줄 요약 | — |
| `/goal [condition\|clear]` | 조건 달성까지 CC가 계속 작업하는 목표 설정 | — |
| `/background [prompt]` | 세션을 백그라운드 에이전트로 분리 | `/bg` |
| `/exit` | CLI 종료. 백그라운드 세션 연결 중이면 분리 | `/quit` |

**`/clear` vs `/compact` 핵심 차이**:

| | `/clear` | `/compact` |
|---|---|---|
| 이전 대화 | `/resume`에 보존 | 계속 사용 (요약 형태) |
| 컨텍스트 | 완전히 초기화 | 요약으로 압축 |
| 용도 | 새 작업 시작 | 같은 작업 컨텍스트 절약 |

---

### 2. 설정·환경

| 커맨드 | 기능 | 별칭/비고 |
|---|---|---|
| `/config` | Settings 인터페이스 (테마·모델·출력 스타일 등) | `/settings` |
| `/status` | Settings → Status 탭. 버전·모델·계정·연결 상태 | — |
| `/model [model]` | 모델 변경. 인수 없으면 인터랙티브 선택기 | — |
| `/effort [level\|auto]` | effort 레벨 설정. `low` `medium` `high` `xhigh` `max` | — |
| `/theme` | 색상 테마 변경 | — |
| `/color [color\|default]` | 프롬프트 바 색상 설정 | — |
| `/permissions` | 허용·요청·거부 규칙 관리 | `/allowed-tools` |
| `/memory` | CLAUDE.md 편집, auto-memory 설정·조회 | — |
| `/hooks` | 훅 구성 보기 | — |
| `/keybindings` | 키바인딩 파일 열기·생성 | — |
| `/terminal-setup` | Shift+Enter 등 터미널 키바인딩 구성 | 일부 터미널만 표시 |
| `/tui [default\|fullscreen]` | UI 렌더러 전환 (flicker-free alt-screen) | — |
| `/add-dir <path>` | 세션에 작업 디렉토리 추가 | — |

---

### 3. 에이전트·병렬 작업

| 커맨드 | 유형 | 기능 | 비고 |
|---|---|---|---|
| `/agents` | 내장 | 서브에이전트 구성 관리 | — |
| `/tasks` | 내장 | 백그라운드 태스크 목록·관리 | `/bashes` |
| `/stop` | 내장 | 현재 백그라운드 세션 중지 | 백그라운드 연결 중만 |
| `/batch <instruction>` | **[Skill]** | 코드베이스 대규모 변경을 5~30개 병렬 유닛으로 분해·실행 | git 저장소 필요 |
| `/background [prompt]` | 내장 | 세션을 백그라운드 에이전트로 분리 | `/bg` |
| `/loop [interval] [prompt]` | **[Skill]** | 세션 동안 프롬프트 반복 실행. 인터벌 생략 시 자율 페이싱 | `/proactive` |
| `/goal [condition]` | 내장 | 조건 달성까지 지속 작업 | — |
| `/autofix-pr [prompt]` | 내장 | PR의 CI 실패·리뷰 댓글 자동 수정하는 원격 세션 생성 | `gh` CLI 필요 |
| `/schedule [description]` | 내장 | 루틴(정기 예약 작업) 생성·관리 | `/routines` |

---

### 4. MCP 관련

| 커맨드 | 기능 | 비고 |
|---|---|---|
| `/mcp` | MCP 서버 연결·OAuth 인증 관리 | — |
| `/mcp__<server>__<prompt>` | MCP 서버가 노출한 프롬프트 실행 | 연결된 서버에서 자동 발견 |

MCP 서버 상세는 `chapters/04-mcp.md` 참고.

---

### 5. 코드 품질·리뷰

| 커맨드 | 유형 | 기능 | 비고 |
|---|---|---|---|
| `/review [PR]` | 내장 | 로컬 PR 코드 리뷰 | — |
| `/security-review` | 내장 | 현재 브랜치 변경사항 보안 취약점 분석 | — |
| `/simplify [focus]` | **[Skill]** | 최근 변경 파일 품질·효율성 검토 후 수정. 3개 리뷰 에이전트 병렬 실행 | — |
| `/diff` | 내장 | 미커밋 변경사항·턴별 diff 인터랙티브 뷰어 | — |
| `/ultrareview [PR]` | 내장 | 클라우드 샌드박스 멀티에이전트 심층 코드 리뷰 | Pro/Max: 3회 무료 |
| `/plan [description]` | 내장 | 플랜 모드 진입 (읽기 전용 → 승인 후 실행) | — |
| `/ultraplan <prompt>` | 내장 | ultraplan 세션에서 계획 작성 후 브라우저 검토 | — |

---

### 6. 프로젝트 초기화·진단

| 커맨드 | 기능 | 비고 |
|---|---|---|
| `/init` | CLAUDE.md 생성으로 프로젝트 초기화. `CLAUDE_CODE_NEW_INIT=1` 시 스킬·훅·메모리까지 포함한 대화형 흐름 | — |
| `/doctor` | 설치·설정 진단. `f` 키로 발견된 문제 자동 수정 | — |
| `/debug [description]` | **[Skill]** 세션 디버그 로깅 활성화 및 로그 분석 | — |
| `/insights` | 세션 분석 리포트 생성 (프로젝트 패턴·마찰 포인트) | — |
| `/heapdump` | JS 힙 스냅샷·메모리 분석 파일 생성 (고메모리 진단) | ~/Desktop 또는 홈 디렉토리 |
| `/feedback [report]` | 피드백·버그 제출 | `/bug` |

---

### 7. 계정·인증

| 커맨드 | 기능 | 비고 |
|---|---|---|
| `/login` | Anthropic 계정 로그인 | — |
| `/logout` | Anthropic 계정 로그아웃 | — |
| `/usage` | 세션 비용·플랜 사용량·활동 통계 | `/cost`, `/stats` |
| `/privacy-settings` | 개인정보 설정 | Pro/Max 전용 |
| `/extra-usage` | 속도 제한 초과 시 추가 사용량 구성 | — |
| `/upgrade` | 상위 플랜 업그레이드 페이지 열기 | — |

---

### 8. 유틸리티

| 커맨드 | 기능 | 별칭/비고 |
|---|---|---|
| `/help` | 사용 가능한 커맨드 목록·도움말 표시 | — |
| `/skills` | 사용 가능한 스킬 목록. `t`로 토큰순 정렬, Space로 표시 토글 | — |
| `/copy [N]` | 마지막 응답 클립보드 복사. N으로 N번째 최신 선택. `w`로 파일 저장 | — |
| `/btw <question>` | 대화 히스토리에 추가되지 않는 사이드 질문 | — |
| `/fast [on\|off]` | fast mode 토글 | — |
| `/release-notes` | 변경 로그 인터랙티브 버전 선택기 | — |
| `/voice [hold\|tap\|off]` | 음성 받아쓰기 토글 | claude.ai 계정 필요 |
| `/desktop` | 현재 세션을 Desktop 앱에서 계속 | macOS/Windows; `/app` |
| `/teleport` | 웹 세션을 이 터미널로 가져오기 | `/tp`; claude.ai 구독 필요 |
| `/remote-control` | 이 세션을 claude.ai에서 원격 제어 가능하게 설정 | `/rc` |
| `/ide` | IDE 통합 관리·상태 표시 | — |
| `/plugin` | 플러그인 관리 | — |
| `/reload-plugins` | 재시작 없이 활성 플러그인 리로드 | — |
| `/chrome` | Claude in Chrome 설정 | — |
| `/install-github-app` | Claude GitHub Actions 앱 설정 | — |
| `/install-slack-app` | Claude Slack 앱 설치 | — |
| `/web-setup` | 로컬 `gh` CLI 자격증명으로 GitHub 계정 연결 | — |
| `/team-onboarding` | 최근 30일 세션으로 팀 온보딩 가이드 생성 | Pro/Max/Team/Enterprise: 공유 링크 |
| `/sandbox` | 샌드박스 모드 토글 | 지원 플랫폼만 |

---

### 9. Skill 커맨드 — 사용자 정의 커맨드

스킬은 `/<skill-name>` 형태의 커맨드를 추가하는 메커니즘이다. CC 번들 스킬(`[Skill]`)과 동일한 방식으로 동작한다.

**스킬 파일 구조**:

```
.claude/skills/<name>/SKILL.md
```

**SKILL.md 최소 frontmatter**:

```yaml
---
name: my-skill
description: "무엇을 하는 스킬인지"
---
```

**번들 스킬 목록** (v2.1.0 기준):

| 커맨드 | 기능 요약 |
|---|---|
| `/batch` | 대규모 병렬 코드 변경 |
| `/claude-api` | Claude API 레퍼런스 로드·마이그레이션 |
| `/debug` | 세션 디버그 로그 분석 |
| `/fewer-permission-prompts` | 트랜스크립트 분석으로 허용 목록 자동 추가 |
| `/loop` | 프롬프트 반복 실행 |
| `/simplify` | 코드 품질 검토 후 수정 |

**스킬 숨기기**: `/skills` 목록에서 Space 키로 특정 스킬을 Claude 컨텍스트 및 `/` 메뉴에서 숨길 수 있다.

---

## 버전별 차이

| 커맨드 | 변경 내용 | 버전 |
|---|---|---|
| `/vim` | **제거됨** (v2.1.92). Vim 모드는 `/config` → Editor mode로 이동 | max: v2.1.91 |
| `/pr-comments` | **제거됨** (v2.1.91). PR 댓글 조회는 Claude에게 직접 요청 | max: v2.1.90 |

> `/vim`, `/pr-comments`를 쓰던 워크플로는 반드시 위 대체 방법으로 전환.

---

## 자주 하는 실수

1. **`-p` 모드에서 슬래시 커맨드 사용 시도** — Non-interactive 모드에서는 완전히 동작하지 않는다. 커맨드 동작을 프롬프트 텍스트로 직접 표현해야 한다.

2. **`/clear`와 `/compact` 혼동** — `/clear`는 새 대화를 시작하고 이전 대화를 `/resume`에 보존한다. `/compact`는 같은 대화를 계속하면서 히스토리를 요약으로 압축한다. 컨텍스트 절약이 목적이면 `/compact`.

3. **`/vim` 사용 (v2.1.92+)** — v2.1.92에서 제거됐다. Vim 모드는 `/config` → Editor mode에서 전환한다.

4. **`/pr-comments` 사용 (v2.1.91+)** — v2.1.91에서 제거됐다. "이 브랜치의 PR 댓글을 가져와줘"처럼 Claude에게 직접 요청한다.

5. **슬래시 커맨드와 CLI 플래그 혼동** — `/model`은 세션 실행 중 모델 변경, `--model`은 시작 시 설정이다. 세션 중 변경은 `/`, 시작 시 고정은 `--`.

---

## 참고

- 공식 커맨드 레퍼런스: https://code.claude.com/docs/en/commands
- CLI 플래그 레퍼런스: https://code.claude.com/docs/en/cli-reference
- 스킬 작성 가이드: https://code.claude.com/docs/en/skills
- Interactive 모드: https://code.claude.com/docs/en/interactive-mode
- 관련 챕터: `chapters/01-concepts.md` (실행 모드), `chapters/02-config.md` (CLI 플래그), `chapters/04-mcp.md` (MCP 커맨드)

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/ryujaeuk/cc-gnothi</sub>
