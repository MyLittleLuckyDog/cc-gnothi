---
type: chapter
chapter: "05"
title: "Skills"
cc_version_min: "2.1.0"
updated: 2026-05-17
tags: ["skills", "slash-commands", "custom-commands", "dynamic-context", "arguments", "frontmatter", "automation", "compaction", "lifecycle"]
related:
  - chapters/01-concepts.md
  - chapters/02-config.md
  - chapters/04-mcp.md
  - chapters/06-hooks.md
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
---

# Skills

> 이 챕터: `/skill-name`으로 호출하는 사용자 정의 커맨드 — 저장 위치, frontmatter 필드, 동적 컨텍스트 주입, 인수 치환, 수명주기.
> 최소 버전: v2.1.0

## 개념

Skills는 반복적으로 입력하던 절차·지침을 `SKILL.md` 파일 하나로 패키징해 `/skill-name`으로 호출 가능한 단위다. CLAUDE.md와 달리 **호출 시에만 컨텍스트에 로드**되므로 긴 참고 자료를 담아도 미사용 시 토큰 비용이 없다.

Claude는 `description`을 보고 스킬을 자동 호출하거나, 사용자가 `/skill-name`을 직접 입력해 호출한다.

기존 `.claude/commands/<name>.md` 파일은 Skills와 동일하게 동작하며 계속 지원된다. Skills는 여기에 supporting files, frontmatter 제어, subagent 실행 등의 기능을 추가한 상위 호환이다. 이름이 충돌하면 Skills가 우선한다.

CC는 `/simplify`, `/batch`, `/debug`, `/loop`, `/claude-api` 등 번들 스킬을 기본 내장한다. 이들은 고정 로직이 아닌 프롬프트 기반으로 동작한다.

---

## 패턴

### 1. 저장 위치와 우선순위

| 범위 | 경로 | 적용 대상 |
|---|---|---|
| Enterprise (managed) | 관리자 설정 참고 | 조직 전체 |
| Personal | `~/.claude/skills/<name>/SKILL.md` | 전 프로젝트 (개인) |
| Project | `.claude/skills/<name>/SKILL.md` | 현재 프로젝트 (팀) |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | 플러그인 활성화 시 |

우선순위: enterprise > personal > project. 플러그인 스킬은 `plugin-name:skill-name` 네임스페이스를 사용해 충돌하지 않는다.

**라이브 변경 감지**: `~/.claude/skills/`, 프로젝트 `.claude/skills/`, `--add-dir` 내 스킬 디렉토리의 파일 변경은 세션 재시작 없이 즉시 반영된다. 단, 세션 시작 후 새 최상위 스킬 디렉토리를 생성했다면 재시작이 필요하다.

**디렉토리 구조**:

```text
my-skill/
├── SKILL.md           # 필수 — 메인 지침
├── reference.md       # 선택 — 상세 레퍼런스 (필요 시 로드)
├── examples/
│   └── sample.md      # 선택 — 예시 출력
└── scripts/
    └── helper.sh      # 선택 — 실행 스크립트
```

`SKILL.md`가 500줄을 넘으면 상세 자료를 별도 파일로 분리하고 `SKILL.md`에서 참조한다.

---

### 2. frontmatter 레퍼런스

```yaml
---
name: my-skill
description: Claude가 스킬 자동 호출 여부를 판단하는 설명 (권장)
---
```

모든 필드는 선택 사항이다. `description`만 권장 필수다.

| 필드 | 필수 | 설명 |
|---|---|---|
| `name` | No | 디렉토리 이름이 기본값. 소문자·숫자·하이픈, 최대 64자 |
| `description` | 권장 | 스킬 용도와 호출 시점. 생략 시 첫 문단 사용. `when_to_use`와 합산 1,536자에서 잘림 |
| `when_to_use` | No | 추가 트리거 문구·예시 요청. `description`에 이어 붙어 1,536자 한도에 포함 |
| `argument-hint` | No | 자동완성에 표시할 인수 힌트. 예: `[issue-number]`, `[filename] [format]` |
| `arguments` | No | `$name` 치환용 위치 인수 이름 목록. 공백 구분 문자열 또는 YAML 리스트 |
| `disable-model-invocation` | No | `true`: Claude 자동 호출 방지, 사용자만 `/name`으로 실행. 기본: `false` |
| `user-invocable` | No | `false`: `/` 메뉴에서 숨김, Claude만 호출. 기본: `true` |
| `allowed-tools` | No | 이 스킬이 활성화된 동안 승인 없이 허용할 도구. 공백 구분 문자열 또는 YAML 리스트 |
| `model` | No | 스킬 실행 시 사용할 모델. 현재 턴에만 적용, settings에 저장 안 됨. `inherit`으로 세션 모델 유지 가능 |
| `effort` | No | 노력 수준 오버라이드. `low` / `medium` / `high` / `xhigh` / `max`. 기본: 세션 상속 |
| `context` | No | `fork`: 포크된 서브에이전트 컨텍스트에서 실행 |
| `agent` | No | `context: fork` 시 사용할 서브에이전트 타입. `Explore` / `Plan` / `general-purpose` 또는 커스텀 |
| `hooks` | No | 이 스킬 수명주기에 스코프된 훅. 형식은 Hooks 챕터 참고 |
| `paths` | No | 특정 파일 경로 패턴 매칭 시에만 자동 활성화. 쉼표 구분 문자열 또는 YAML 리스트 |
| `shell` | No | `` !`command` `` 블록 실행 쉘. `bash` (기본) 또는 `powershell`. PowerShell은 `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` 필요 |

#### 호출 제어 대조표

| frontmatter | 사용자 호출 | Claude 자동 호출 | 컨텍스트 로드 시점 |
|---|---|---|---|
| (기본) | 가능 | 가능 | 설명은 항상, 본문은 호출 시 |
| `disable-model-invocation: true` | 가능 | 불가 | 설명 비포함, 본문은 사용자 호출 시 |
| `user-invocable: false` | 불가 | 가능 | 설명은 항상, 본문은 Claude 호출 시 |

---

### 3. 인수 치환

| 변수 | 설명 |
|---|---|
| `$ARGUMENTS` | 호출 시 전달된 전체 인수 문자열. 스킬 본문에 없으면 `ARGUMENTS: <값>`으로 끝에 추가 |
| `$ARGUMENTS[N]` | 0-based 인덱스로 특정 인수 접근 |
| `$N` | `$ARGUMENTS[N]` 단축형. `$0` = 첫 번째, `$1` = 두 번째 |
| `$name` | `arguments` frontmatter에 선언한 이름 기반 위치 인수 |
| `${CLAUDE_SESSION_ID}` | 현재 세션 ID |
| `${CLAUDE_EFFORT}` | 현재 노력 수준: `low` / `medium` / `high` / `xhigh` / `max` |
| `${CLAUDE_SKILL_DIR}` | 스킬 `SKILL.md`가 있는 디렉토리 절대 경로 |

다중 단어 인수는 따옴표로 묶는다: `/my-skill "hello world" second` → `$0` = `hello world`, `$1` = `second`.

**이름 기반 인수 예시**:

```yaml
---
name: migrate-component
description: 컴포넌트를 다른 프레임워크로 마이그레이션
arguments: [component, from, to]
---

$component 컴포넌트를 $from에서 $to로 마이그레이션하세요.
기존 동작과 테스트를 모두 유지하세요.
```

---

### 4. 동적 컨텍스트 주입

`` !`<command>` `` 구문으로 스킬 로드 시점에 쉘 명령을 실행하고 출력을 인라인 삽입한다. Claude가 명령을 실행하는 것이 아니라 **Claude가 스킬 내용을 받기 전에 CC가 전처리**한다.

```yaml
---
name: summarize-changes
description: 커밋되지 않은 변경사항 요약 및 위험 요소 식별. 변경 내용 확인, 커밋 메시지 작성, diff 리뷰 시 사용.
---

## 현재 변경사항

!`git diff HEAD`

## 지침

위 변경사항을 2~3줄로 요약하고, 누락된 에러 처리·하드코딩된 값·업데이트가 필요한 테스트 등 위험 요소를 나열하세요.
diff가 비어 있으면 커밋되지 않은 변경사항이 없다고 답하세요.
```

동작 순서:

1. `` !`git diff HEAD` `` 즉시 실행
2. 출력이 해당 위치에 인라인 삽입
3. Claude는 실제 diff가 포함된 완성된 프롬프트를 수신

**주의사항**:

- 치환은 원본 파일을 1회만 스캔. 명령 출력이 다시 `` !`cmd` ``를 포함해도 2차 확장 없음
- 멀티라인 명령은 펜스 블록(` ```! ` 시작) 사용
- `disableSkillShellExecution: true` 설정 시 `` !`cmd` `` 실행 비활성화, `[shell command execution disabled by policy]`로 대체 (managed 환경 권장)

**멀티라인 주입 예시**:

````markdown
## 환경 정보
```!
node --version
npm --version
git status --short
```
````

---

### 5. allowed-tools로 도구 사전 승인

`allowed-tools` 필드는 스킬이 활성화된 동안 해당 도구를 승인 없이 사용하도록 허가한다. 도구를 제한하는 것이 아니라 **승인 요청을 생략**하는 것이다.

```yaml
---
name: commit
description: 변경사항을 스테이지하고 커밋
disable-model-invocation: true
allowed-tools: Bash(git add *) Bash(git commit *) Bash(git status *)
---

변경사항을 스테이지하고 의미 있는 커밋 메시지로 커밋하세요.
커밋 전에 git status로 스테이지 상태를 확인하세요.
```

프로젝트 `.claude/skills/`에 체크인된 스킬의 `allowed-tools`는 해당 폴더 신뢰 대화상자 수락 후 적용된다.

---

### 6. $ARGUMENTS 인수 전달

```yaml
---
name: fix-issue
description: GitHub 이슈 번호로 이슈 수정
disable-model-invocation: true
---

우리 코딩 표준에 따라 GitHub 이슈 $ARGUMENTS를 수정하세요.

1. 이슈 설명 읽기
2. 요구사항 파악
3. 수정 구현
4. 테스트 작성
5. 커밋 생성
```

`/fix-issue 123` 실행 시 Claude는 "우리 코딩 표준에 따라 GitHub 이슈 123을 수정하세요."를 수신한다.

---

### 7. 스킬 수명주기

| 단계 | 동작 |
|---|---|
| 호출 | 렌더링된 `SKILL.md` 내용이 대화에 단일 메시지로 진입 |
| 세션 중 | 내용이 컨텍스트에 잔존. CC는 이후 턴에 파일을 재읽지 않음 |
| compact 후 재첨부 | 가장 최근 호출한 스킬부터 최대 5,000토큰씩 재첨부 |
| compact 예산 한도 | 재첨부 스킬 전체 합산 25,000토큰. 초과 시 오래된 스킬 제외 |

스킬 내용을 간결하게 유지해야 하는 이유: 호출 이후 모든 턴에서 토큰 비용이 발생한다. 일회성 단계가 아닌 **항시 적용될 지침**으로 작성한다.

compact 후 스킬이 행동에 영향을 미치지 않는 것처럼 보이면 `/skill-name`으로 재호출해 전체 내용을 복원한다.

---

### 8. 스킬 가시성 오버라이드

`skillOverrides` 설정으로 SKILL.md를 수정하지 않고 가시성을 제어할 수 있다. `/skills` 메뉴에서 스킬 강조 후 `Space`로 상태 전환, `Enter`로 `.claude/settings.local.json`에 저장.

| 값 | Claude에 노출 | `/` 메뉴 |
|---|---|---|
| `"on"` (기본) | 이름 + 설명 | 표시 |
| `"name-only"` | 이름만 | 표시 |
| `"user-invocable-only"` | 숨김 | 표시 |
| `"off"` | 숨김 | 숨김 |

```json
{
  "skillOverrides": {
    "legacy-context": "name-only",
    "deploy": "off"
  }
}
```

플러그인 스킬은 `skillOverrides` 영향을 받지 않는다. `/plugin`으로 관리한다.

---

### 9. subagent에서 스킬 실행

`context: fork` frontmatter를 추가하면 스킬이 격리된 서브에이전트에서 실행된다. 스킬 내용이 서브에이전트의 프롬프트가 되며, 대화 히스토리에 접근할 수 없다.

```yaml
---
name: deep-research
description: 주제를 코드베이스에서 철저히 리서치
context: fork
agent: Explore
---

$ARGUMENTS를 철저히 리서치하세요:

1. Glob과 Grep으로 관련 파일 탐색
2. 코드 읽고 분석
3. 구체적인 파일 참조와 함께 결과 요약
```

`context: fork`는 명확한 태스크 지침이 있는 스킬에만 의미가 있다. 가이드라인만 담긴 스킬에 적용하면 서브에이전트가 실행할 액션 없이 반환한다.

---

## 버전별 차이

| 항목 | v2.1.x 이전 | v2.1.x 이후 |
|---|---|---|
| 커스텀 커맨드 | `.claude/commands/<name>.md` | `.claude/skills/<name>/SKILL.md` (상위 호환) |
| supporting files | 불가 | 스킬 디렉토리 내 여러 파일 지원 |
| `skillOverrides` | 미지원 | `/skills` 메뉴 + `settings.local.json` |
| 번들 스킬 | 미지원 또는 제한적 | `/simplify`, `/batch`, `/debug`, `/loop`, `/claude-api` 포함 |
| 라이브 변경 감지 | 미지원 | 세션 재시작 없이 즉시 반영 |
| 부모/중첩 디렉토리 탐색 | 미지원 | 시작 디렉토리 상위 + 하위 `.claude/skills/` 자동 탐색 |

`.claude/commands/` 파일은 계속 동작하며 동일한 frontmatter를 지원한다. 이름 충돌 시 Skills 우선.

---

## 자주 하는 실수

1. **SKILL.md를 장황하게 작성** — 호출 후 모든 턴에서 토큰을 소모한다. 상세 자료는 별도 파일로 분리하고 SKILL.md에서 참조.

2. **CC가 이후 턴에 SKILL.md를 재읽는다고 가정** — 호출 시 1회 삽입 후 끝이다. 단계별 절차가 아닌 항시 적용 지침으로 작성할 것.

3. **`description` + `when_to_use` 1,536자 초과** — 초과분이 잘려 Claude가 키워드를 인식하지 못한다. 핵심 키워드를 앞에 배치.

4. **`user-invocable: false`와 `disable-model-invocation: true` 혼동**:
   - `user-invocable: false` → 사용자가 `/` 메뉴에서 호출 불가, Claude는 자동 호출 가능
   - `disable-model-invocation: true` → Claude 자동 호출 완전 차단, 사용자만 직접 호출 가능

5. **스킬이 자동 호출되지 않음** — `description`에 사용자가 실제로 입력할 키워드가 없거나, 스킬 수가 많아 설명 예산 초과. `/doctor`로 확인 후 `skillListingBudgetFraction` 또는 `maxSkillDescriptionChars` 조정.

6. **스킬이 너무 자주 자동 호출됨** — `description`이 모호하다. 구체적으로 좁히거나 `disable-model-invocation: true` 추가.

7. **compact 후 스킬 비활성화** — 스킬 수가 많으면 25,000토큰 예산 초과로 오래된 스킬이 제외된다. 필요하면 `/skill-name`으로 재호출.

8. **`context: fork` 스킬에 가이드라인만 작성** — 서브에이전트는 실행할 태스크가 없어 빈 결과를 반환한다. 명확한 지시사항 포함 필수.

---

## 참고

- 공식 스킬 문서: https://code.claude.com/docs/en/skills
- 커맨드 레퍼런스 (번들 스킬 목록): https://code.claude.com/docs/en/commands
- 훅과 스킬 연계: https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents
- 서브에이전트에 스킬 사전 주입: https://code.claude.com/docs/en/sub-agents#preload-skills-into-subagents
- 플러그인으로 스킬 배포: https://code.claude.com/docs/en/plugins
- 권한 설정: https://code.claude.com/docs/en/permissions
- 설정 레퍼런스 (`skillListingBudgetFraction`, `maxSkillDescriptionChars`): https://code.claude.com/docs/en/settings#available-settings
- 관련 챕터: `chapters/01-concepts.md`, `chapters/04-mcp.md`, `chapters/06-hooks.md`

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/ryujaeuk/cc-gnothi</sub>
