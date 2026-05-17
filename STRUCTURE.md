---
type: meta
title: "cc-gnothi 저장소 구조"
audience: "문서 작성자, 자동화 스크립트, MCP 서버"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
---

# cc-gnothi 저장소 구조

## 디렉토리 역할

```
cc-gnothi/
├── docs/                    읽기 전용. 자동화 쓰기 금지.
│   ├── cc-gnothi-docs/      설계 청사진·작성 가이드·템플릿
│   ├── chapters/            버전 무관 개념·패턴 (사람이 큐레이션)
│   ├── reference/           CLI 플래그·환경변수 레퍼런스 (수동)
│   └── anthropic-docs/      공식 문서 요약 (부트스트랩 참고용)
│
├── versions/                자동화 출력 전용. 자동화만 쓴다.
│   └── v{X.X.X}/
│       ├── _index.md        버전 메타 + feature-spec 목록 + 챕터 제안
│       └── {feature}.md     기능별 검증된 동작 명세 (feature-spec)
│
├── scripts/                 자동화 스크립트
│   ├── analyze-new-version.js   새 버전 artifact 분석 + versions/ 초안 생성
│   └── sync-and-analyze.sh      caludeCodeAVX2 pull → 분석 실행 (트리거 래퍼)
│
└── src/                     cc-gnothi-mcp Rust 소스 (예정)
```

## 문서 유형 구분

| 유형 | 경로 | 작성자 | 버전 종속 | 역할 |
|---|---|---|---|---|
| `chapter` | `docs/chapters/` | 사람 | ✗ | 버전 무관 개념·패턴·사용법 |
| `feature-spec` | `versions/v{X}/{feature}.md` | 자동화 | ✓ | 특정 버전에서 검증된 동작 명세 |
| `reference` | `docs/reference/` | 사람 | △ | CLI 플래그·환경변수 (안정적) |

**`chapters/` 포함 기준**: 버전이 바뀌어도 개념 자체가 바뀌지 않는 내용.  
**`versions/{feature}.md` 포함 기준**: 버전마다 동작이 달라질 수 있는 모든 기능 명세.

### docs/chapters/ 현재 목록

| 파일 | 주제 |
|---|---|
| 01-concepts.md | CC 아키텍처 개념 |
| 02-config.md | 설정 체계 (CLAUDE.md, settings.json) |
| 04-mcp.md | MCP 설정·활용 |
| 05-skills.md | Skills·Plugin |
| 06-hooks.md | Hook 자동화 |
| 07-agents.md | 멀티에이전트·서브에이전트 |
| 08-prompting.md | 프롬프트 작성법 |
| 10-patterns.md | 실전 워크플로우 패턴 |

> 슬래시 커맨드(03)·출력 포맷(09)는 버전 종속 → `versions/` 산하 feature-spec으로 관리.

## 딜리버리 아키텍처

```
docs/**/*.md + versions/**/*.md
     ↓
cc-gnothi-mcp (Rust)  MD 로드 → ## 헤딩 단위 청크 → JSON 정규화
     ↓
MCP 쿼리 라우팅
  "config 어떻게 써?"      → docs/chapters/02-config.md
  "/goal 어떻게 동작해?"   → versions/v{최신}/goal.md
  "새 /xyz 커맨드?"        → versions/v{최신}/commands.md (자동 반영)
     ↓
CC (Claude Code)  관련 청크 수신. MD 원본 직접 접근 없음.
```

MD 파일에서 토큰 수는 관리하지 않는다. MCP가 섹션 단위 청크로 토큰 안전 범위 조정.  
파일 크기(KB)만 분리 기준 — 자세한 기준은 `WRITING_GUIDE.md` 참고.

## 쓰기 권한 규칙

| 경로 | 사람 | 자동화 |
|---|---|---|
| `docs/**` | 쓰기 가능 | **읽기 전용** |
| `versions/**` | 검수·수정 가능 | 쓰기 가능 |
| `src/**` | 쓰기 가능 | 해당 없음 |

## 새 기능 자동 반영 흐름

새 버전 artifact에서 신규 기능이 감지되면 자동화가 즉시 `versions/`에 작성.  
`docs/chapters/`는 건드리지 않는다. MCP가 최신 feature-spec을 자동 서빙.

```
새 artifact 감지
  ↓
versions/v{X}/{feature}.md  검증된 동작 명세 작성  ← 자동화
versions/v{X}/_index.md     챕터 제안 섹션 기록    ← 자동화
  ↓
MCP 즉시 서빙 (승격 불필요)

별도 판단 필요한 경우에만 (자동화가 _index.md 챕터 제안에 기록):
  → 개념 레이어 변경이면   docs/chapters/ 해당 파일 수동 수정
  → 신규 개념 도메인이면   docs/chapters/ 신규 파일 수동 작성
```

## 진실의 원천 계층

```
1순위  versions/v{X.X.X}/*.md   번들 직접 분석. 검증된 사실만. 최신 버전이 우선.
2순위  docs/chapters/           버전 무관 개념·패턴. 사람이 큐레이션.
3순위  docs/anthropic-docs/     공식 문서 요약. 최신화 보장 안됨. 충돌 시 번들 우선.
```

## versions/ 문서 작성 원칙

- 번들 코드 직접 인용 금지 (길이 무관)
- 모든 동작 명세는 해당 버전 bundle.js를 직접 읽어 검증한 것이어야 한다
- 로직은 검증된 동작 명세 (언어 중립 의사코드)로 재작성
- 복잡한 분기는 Mermaid 흐름도로
- 동작 상수·제한값은 숫자 사실로 기재 (추측 금지)
- 분석 출처 필수 명시: `분석 기준: CC v{X.X.X} bundle.js:{line}`
- 출처를 댈 수 없는 주장은 작성 금지
- 자세한 기준 → `docs/cc-gnothi-docs/WRITING_GUIDE.md`

### docs/anthropic-docs/ 현재 목록

| 파일 | 원본 소스 |
|---|---|
| cc-cli-reference.md | code.claude.com/docs/en/cli-reference, /commands, /env-vars |
| cc-features.md | /memory, /mcp, /hooks, /skills, /sub-agents |
| cc-workflows.md | /common-workflows, /best-practices |
| prompt-engineering.md | docs.anthropic.com prompt-engineering/overview + best-practices |
