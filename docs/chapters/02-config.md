---
type: chapter
chapter: "02"
title: "설정 체계"
cc_version_min: "2.1.0"
updated: 2026-05-17
tags: ["config", "settings", "configuration", "claude-md", "memory", "auto-memory", "permissions", "rules", "path-scoped", "hierarchy"]
related:
  - chapters/01-concepts.md
  - chapters/03-commands.md
  - chapters/06-hooks.md
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
---

# 설정 체계

> 이 챕터: CLAUDE.md 4단계 계층·로드 규칙, settings.json 구조·권한 문법, auto memory 동작 범위를 하나의 지도로 정리한다.  
> 최소 버전: v2.1.0 (auto memory는 v2.1.59+)

---

## 개념

CC의 설정은 두 축으로 나뉜다: **행동 지침(CLAUDE.md)** 과 **기술 설정(settings.json)**. 이 둘은 병렬 4단계 계층을 공유하지만 병합 규칙이 다르다.

- **CLAUDE.md**: 세션 시작 시 컨텍스트 창에 **사용자 메시지**로 주입. 시스템 프롬프트가 아님 → 강제 준수 아님.
- **settings.json**: 런타임이 파싱하는 기술 설정. permission·hooks·MCP 등 하드 제어.
- **Auto memory**: CC가 스스로 기록하는 `MEMORY.md`. 세션 시작 시 첫 200줄/25KB 자동 주입.

---

## 패턴

### 1. CLAUDE.md 4단계 계층

로드 순서: **낮은 우선순위 → 높은 우선순위** (아래 테이블 위 → 아래).

| 단계 | 파일 위치 | 플랫폼 | 공유 대상 | 특징 |
|---|---|---|---|---|
| **Managed policy** | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md` | macOS | 조직 전체 | IT/DevOps 배포. 개인 설정으로 제외 불가 |
| | Linux/WSL: `/etc/claude-code/CLAUDE.md` | Linux/WSL | 조직 전체 | |
| | Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | Windows | 조직 전체 | |
| **User** | `~/.claude/CLAUDE.md` | 전 플랫폼 | 본인 (전 프로젝트) | 개인 선호 |
| **Project** | `./CLAUDE.md` 또는 `./.claude/CLAUDE.md` | 전 플랫폼 | 팀 (버전 관리) | 프로젝트 표준 |
| **Local** | `./CLAUDE.local.md` | 전 플랫폼 | 본인 (현재 프로젝트) | `.gitignore` 추가 권장 |

**로드 규칙:**

- 작업 디렉토리 위 조상 디렉토리의 `CLAUDE.md` / `CLAUDE.local.md`는 **시작 시 전체 로드**.
- 서브디렉토리의 `CLAUDE.md`는 **해당 디렉토리 파일 작업 시** 지연 로드.
- 파일들은 상호 override가 아닌 **연결(concatenate)**: 파일시스템 루트 → 작업 디렉토리 방향 순서.
- 같은 디렉토리에서는 `CLAUDE.md` 먼저, `CLAUDE.local.md` 나중.
- Block-level HTML 주석(`<!-- -->`)은 주입 전 자동 제거됨. 코드 블록 내 주석은 유지.

**`@` 임포트 구문:**

```markdown
See @README for project overview and @package.json for available npm commands.

# Additional Instructions
- git workflow @docs/git-instructions.md
```

- 상대 경로는 임포트 파일 기준(작업 디렉토리 아님).
- 최대 5단계 재귀 임포트.
- 임포트 파일도 시작 시 컨텍스트에 전체 로드됨 → 토큰 절감 효과 없음.

---

### 2. CLAUDE.md 작성 요령

**200줄 제한 이유:**

CLAUDE.md는 사용자 메시지로 주입된다. 파일이 클수록 모델이 지시를 놓칠 가능성이 높아진다. 200줄을 초과하면 준수율이 떨어진다.

| 권장 | 대안 |
|---|---|
| 자주 바뀌지 않는 전역 규칙 | CLAUDE.md 루트에 유지 |
| 특정 파일 타입 규칙 | `.claude/rules/` path-scoped rule로 분리 |
| 복잡한 절차 | Skill로 패키징 |
| 프로젝트별 개인 선호 | `CLAUDE.local.md` |

**`.claude/rules/` 분산 패턴:**

```
your-project/
├── CLAUDE.md              # 핵심 프로젝트 규칙 (200줄 이내)
└── .claude/
    ├── CLAUDE.md          # 대안 위치 (CLAUDE.md와 중복 불가)
    └── rules/
        ├── code-style.md  # 코딩 스타일 (전체 적용)
        ├── testing.md     # 테스트 규칙 (전체 적용)
        └── api-design.md  # API 규칙 (path-scoped)
```

**Path-scoped rule — frontmatter 형식:**

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "src/**/*.{ts,tsx}"
---

# API Development Rules

- All API endpoints must include input validation
- Use the standard error response format
```

| glob 패턴 | 매칭 대상 |
|---|---|
| `**/*.ts` | 모든 디렉토리의 `.ts` 파일 |
| `src/**/*` | `src/` 하위 전체 |
| `*.md` | 프로젝트 루트 마크다운 |
| `src/components/*.tsx` | 특정 디렉토리의 `.tsx` |

- `paths` 없는 rule: 시작 시 무조건 로드 (`.claude/CLAUDE.md`와 동일 우선순위).
- path-scoped rule: 매칭 파일 **읽기** 시 로드. 매 도구 호출마다 아님.
- User-level rules: `~/.claude/rules/` — 전 프로젝트 개인 규칙.

**`claudeMdExcludes` — 모노레포 탈출:**

```json
// .claude/settings.local.json
{
  "claudeMdExcludes": [
    "**/other-team/CLAUDE.md",
    "/home/user/monorepo/other-team/.claude/rules/**"
  ]
}
```

- 절대 경로 glob 매칭.
- Managed CLAUDE.md는 제외 불가.
- user/project/local/managed 모든 계층에서 설정 가능. 배열은 계층 간 병합.

**`claudeMd` managed setting — 파일 없이 배포:**

```json
// managed-settings.json
{
  "claudeMd": "Always run `make lint` before committing.\nNever push directly to main."
}
```

- managed settings에서만 유효. user/project/local 설정에서는 무시.

**`AGENTS.md` 공존 패턴:**

```markdown
<!-- CLAUDE.md -->
@AGENTS.md

## Claude Code
Use plan mode for changes under `src/billing/`.
```

또는 심볼릭 링크 (Windows 제외):

```bash
ln -s AGENTS.md CLAUDE.md
```

---

### 3. settings.json 구조

**파일 위치 및 범위:**

| 범위 | 파일 | 공유 | 특징 |
|---|---|---|---|
| **Managed** | `/Library/Application Support/ClaudeCode/managed-settings.json` (macOS) | 조직 전체 | IT 배포. 오버라이드 불가 |
| **User** | `~/.claude/settings.json` | 본인 (전 프로젝트) | 개인 기본값 |
| **Project** | `.claude/settings.json` | 팀 (버전 관리) | 팀 표준 |
| **Local** | `.claude/settings.local.json` | 본인 (현재 프로젝트) | `.gitignore` 추가 권장 |

**우선순위 (높음 → 낮음):**

```
Managed → CLI arguments → Local → Project → User
```

예외: `permissions` 규칙은 override가 아닌 **모든 계층 병합**.

**주요 키 목록:**

| 카테고리 | 키 | 타입 | 설명 |
|---|---|---|---|
| **모델** | `model` | string | 기본 모델 |
| | `effortLevel` | string | `"low"`, `"medium"`, `"high"`, `"xhigh"` |
| | `alwaysThinkingEnabled` | boolean | 확장 사고 기본 활성화 |
| **권한** | `permissions.allow` | array | 자동 승인 규칙 |
| | `permissions.deny` | array | 차단 규칙 |
| | `permissions.ask` | array | 확인 요청 규칙 |
| | `permissions.defaultMode` | string | `"default"`, `"acceptEdits"`, `"plan"`, `"auto"`, `"dontAsk"`, `"bypassPermissions"` |
| | `permissions.additionalDirectories` | array | 추가 파일 접근 디렉토리 |
| **메모리** | `autoMemoryEnabled` | boolean | auto memory 활성화 (기본: true) |
| | `autoMemoryDirectory` | string | 커스텀 저장 경로 (절대경로 또는 `~/`) |
| | `claudeMdExcludes` | array | 제외할 CLAUDE.md glob 패턴 |
| **UI** | `tui` | string | `"default"`, `"fullscreen"` |
| | `editorMode` | string | `"normal"`, `"vim"` |
| | `language` | string | 응답 언어 (예: `"korean"`) |
| **업데이트** | `autoUpdatesChannel` | string | `"latest"`, `"stable"` |
| | `minimumVersion` | string | 최소 버전 강제 |
| **Git** | `attribution.commit` | string | 커밋 어트리뷰션 문자열 |
| **MCP** | `enableAllProjectMcpServers` | boolean | `.mcp.json` 서버 전체 자동 승인 |
| **훅** | `hooks` | object | 라이프사이클 훅 설정 |
| | `disableAllHooks` | boolean | 전체 훅 비활성화 |
| **스킬** | `skillListingBudgetFraction` | number | 스킬 목록 컨텍스트 비율 (v2.1.105+) |
| | `skillOverrides` | object | 스킬별 가시성 오버라이드 (v2.1.129+) |

**권한 규칙 문법:**

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run test *)",
      "Bash(git diff *)",
      "Read(~/.zshrc)"
    ],
    "ask": [
      "Bash(git push *)"
    ],
    "deny": [
      "Bash(curl *)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "WebFetch(domain:sensitive.example.com)"
    ]
  }
}
```

평가 순서: **deny 먼저 → ask → allow**. 첫 매칭 규칙 적용.

| 도구 | 패턴 형식 | 예시 |
|---|---|---|
| `Bash` | 명령어 prefix | `Bash(npm run *)`, `Bash(curl *)` |
| `Read` | 파일/디렉토리 경로 | `Read(./.env)`, `Read(./secrets/**)` |
| `Edit` | 파일/디렉토리 경로 | `Edit(./src/**)` |
| `WebFetch` | 도메인 매칭 | `WebFetch(domain:example.com)` |
| `MCP` | 서버·도구 | `MCP(server:memory)` |
| `Agent` | 서브에이전트 이름 | `Agent(code-reviewer)` |

- `*`: 경로 세그먼트 내 임의 시퀀스
- `**`: 디렉토리 경계 횡단

**최소 프로젝트 settings.json 예시:**

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run test *)",
      "Bash(npm run build)",
      "Bash(git status)",
      "Bash(git diff *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)"
    ]
  }
}
```

---

### 4. Auto memory

**개요:**

| 항목 | 값 |
|---|---|
| 최소 버전 | v2.1.59 |
| 저장 위치 | `~/.claude/projects/<project>/memory/` |
| 진입점 | `MEMORY.md` (인덱스 역할) |
| 로드 범위 | `MEMORY.md` 첫 200줄 또는 25KB (먼저 도달하는 쪽) |
| 기본값 | 활성화 |
| 토글 | `/memory` 명령 또는 `"autoMemoryEnabled": false` |
| 환경변수 토글 | `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` |

**디렉토리 구조:**

```
~/.claude/projects/<project>/memory/
├── MEMORY.md          # 인덱스. 매 세션 자동 주입 (첫 200줄/25KB)
├── debugging.md       # 디버깅 패턴 상세
├── api-conventions.md # API 설계 결정
└── ...                # CC가 자율적으로 생성하는 토픽 파일들
```

- `<project>` 경로: git 레포 기준 파생. 같은 레포의 모든 worktree·서브디렉토리가 동일 디렉토리 공유.
- git 레포 밖: 프로젝트 루트 기준.
- 토픽 파일(`debugging.md` 등): 시작 시 로드 안 됨. CC가 필요 시 표준 파일 도구로 직접 읽음.
- machine-local. 클라우드/다른 머신과 공유 안 됨.

**CC가 자동 저장하는 것들:**

| 유형 | 예시 |
|---|---|
| 빌드·테스트 명령 | `npm run test -- --watch`, `make build-fast` |
| 디버깅 인사이트 | 특정 에러 패턴과 해결법 |
| 아키텍처 메모 | 레이어 구조, 핵심 모듈 위치 |
| 코드 스타일 선호 | 사용자가 수정으로 보정한 패턴 |
| 워크플로 습관 | 자주 쓰는 명령 시퀀스 |

CC가 매 세션 저장하지는 않는다. 미래 대화에서 유용할 것이라 판단할 때만 기록.

**커스텀 저장 경로:**

```json
// ~/.claude/settings.json (user 계층만 허용)
{
  "autoMemoryDirectory": "~/my-custom-memory-dir"
}
```

- 절대경로 또는 `~/`로 시작해야 함.
- **policy·user settings에서만 허용**. project/local settings 불가. (보안: 클론된 레포가 임의 경로로 쓰기 리다이렉트 방지)

**메모리 파일 관리:**

```bash
# 세션 내 메모리 탐색
/memory

# 버전에서 보이는 상태 메시지
# "Writing memory" — CC가 MEMORY.md 업데이트 중
# "Recalled memory" — CC가 토픽 파일 읽는 중
```

---

## 버전별 차이

| 기능 | v2.0.x | v2.1.0+ | 상세 버전 |
|---|---|---|---|
| Auto memory | 미지원 | 지원 | v2.1.59+ |
| Path-scoped rules (`.claude/rules/`) | 미지원 | 지원 | v2.1.0 이후 |
| `skillListingBudgetFraction` | 미지원 | 지원 | v2.1.105+ |
| `maxSkillDescriptionChars` | 미지원 | 지원 | v2.1.105+ |
| `skillOverrides` | 미지원 | 지원 | v2.1.129+ |
| `disableRemoteControl` | 미지원 | 지원 | v2.1.128+ |
| `parentSettingsBehavior` | 미지원 | 지원 | v2.1.133+ |
| `policyHelper` | 미지원 | 지원 | v2.1.136+ |
| User-level `~/.claude/rules/` | 불명 | 지원 | v2.1.x |

---

## 자주 하는 실수

1. **CLAUDE.md를 200줄 초과로 작성** — 준수율 저하. 전역 필수 규칙만 루트에, 나머지는 `.claude/rules/`로 분산.

2. **서브디렉토리 CLAUDE.md가 항상 로드된다고 가정** — 서브디렉토리 파일은 CC가 그 디렉토리 파일을 작업할 때만 지연 로드. 전역으로 필요한 내용은 루트 CLAUDE.md에.

3. **`/compact` 후 서브디렉토리 규칙이 사라졌다고 혼란** — `/compact` 후 루트 CLAUDE.md는 재주입되지만 서브디렉토리 CLAUDE.md는 자동 재주입 안 됨. 해당 디렉토리 파일을 다시 열면 재로드.

4. **HTML 주석을 정보 저장소로 사용** — `<!-- -->` 블록 주석은 주입 전 자동 제거. 인간 유지보수 메모 용도만. CC에 전달이 필요한 내용은 일반 텍스트로.

5. **permission 규칙이 높은 계층에서 낮은 계층을 override한다고 가정** — permissions는 모든 계층이 **병합**. Local에서 `allow: ["Bash(rm *)"]` 추가해도 Project의 `deny: ["Bash(rm *)"]`이 함께 적용되어 deny가 이긴다 (deny 우선 평가).

6. **`autoMemoryDirectory`를 project settings에서 설정** — project/local settings에서는 무시. 반드시 `~/.claude/settings.json` (user) 또는 managed settings에.

7. **Managed CLAUDE.md를 `claudeMdExcludes`로 제외 시도** — Managed 계층 CLAUDE.md는 항상 로드. 제외 불가.

8. **`@` 임포트로 토큰을 절약한다고 기대** — 임포트 파일도 시작 시 전체 로드. 파일 조직 목적으로만. path-scoped rule만 조건부 로드.

---

## 참고

- 공식 메모리 문서: https://code.claude.com/docs/en/memory
- 공식 설정 문서: https://code.claude.com/docs/en/settings
- Settings JSON Schema: https://json.schemastore.org/claude-code-settings.json
- 관련 챕터: `chapters/01-concepts.md` (컨텍스트 시스템 개요), `chapters/06-hooks.md` (settings.json 훅 설정)

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/ryujaeuk/cc-gnothi</sub>
