---
type: meta
title: "cc-gnothi 문서 작성 가이드"
audience: "문서 작성자 (human)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
---

# cc-gnothi 문서 작성 가이드

> **독자는 사람이 아니라 CC다.**  
> 이 가이드는 사람인 문서 작성자를 위한 것이다.

---

## 핵심 원칙

### 1. AI가 파싱하기 좋게 써라

CC는 자연어보다 구조화된 형식을 더 잘 처리한다.

```markdown
# Bad
MCP 설정은 여러 곳에 할 수 있는데, 프로젝트 레벨에서 하려면
.mcp.json 파일을 쓰고, 유저 레벨에서 하려면 settings.json을 써야 해.

# Good
## MCP 설정 위치

| 스코프 | 파일 | 특징 |
|---|---|---|
| 프로젝트 | .mcp.json | 팀 공유, 버전관리 |
| 유저 | ~/.claude/settings.json | 개인 전용 |
```

### 2. 파일당 하나의 토픽

하나의 파일이 두 가지 이상을 다루면 QMD 검색 정밀도가 떨어진다.

```
# Bad
chapters/mcp-and-hooks.md

# Good
chapters/04-mcp.md
chapters/06-hooks.md
```

### 3. 파일 크기로 관리하라

토큰 수는 MD 파일에서 관리하지 않는다. MCP 서버가 MD → JSON 변환 시 섹션 단위로 청크해서 토큰 안전 범위로 딜리버리한다.

MD 파일에서 지키는 기준은 **파일 크기**뿐이다:

| 파일 유형 | 권장 | 분리 기준 |
|---|---|---|
| chapters/*.md | < 30 KB | 30 KB 초과 시 토픽 분리 |
| reference/*.md | < 50 KB | 50 KB 초과 시 파일 분리 |
| versions/{ver}/*.md | < 20 KB | 기능별로 파일 분리 |
| anthropic-docs/*.md | < 50 KB | 주제별 파일 분리 |

`token_budget` frontmatter는 MCP 청킹 힌트용으로만 남긴다. 하드 리밋 아님.

### 4. 예제는 동작하는 코드만

```markdown
# Bad
# 이렇게 하면 됩니다 (미검증)
claude --some-flag

# Good
# 검증된 예제
claude --version  # → claude 2.2.x
```

### 5. 버전을 명시하라

```markdown
# Bad
`/effort` 커맨드로 노력 수준을 조절할 수 있다.

# Good
`/effort` 커맨드 (v2.1.0+) — 노력 수준 조절.
v2.0.x에서는 미지원.
```

---

## frontmatter 필수 항목

모든 문서에 반드시 포함:

```yaml
---
type: version | chapter | reference | index
cc_version_min: "2.x.x"   # 또는 cc_version (버전 문서)
updated: "YYYY-MM-DD"
tags: ["tag1", "tag2"]     # QMD 검색 키워드
token_budget: 800          # 목표 토큰 수
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/ryujaeuk/cc-gnothi"
license: "CC BY-NC-SA 4.0"
---
```

---

## 태그 작성 규칙

태그는 QMD의 BM25 검색 키워드다. 신중히 선택.

- 기능명 그대로: `mcp`, `hooks`, `agents`, `skills`
- 동의어 포함: `config`, `settings`, `configuration`
- 동작 동사 포함: `automation`, `debugging`, `prompting`
- 버전 태그: `v2.1`, `v2.2` (버전 문서만)

---

## 섹션 구조 규칙

```markdown
## 개념     ← 왜/원리. 200토큰 이내
## 패턴     ← 실전 사용법. 메인 섹션
## 버전별 차이  ← 테이블로
## 자주 하는 실수  ← 번호 목록
## 참고     ← 링크만
```

순서 변경 금지. CC가 섹션 위치로 내용 유형을 예측한다.

---

## versions/ 문서의 진실 기준

> **versions/ 하위 문서는 해당 버전 bundle.js를 직접 분석한 결과만 담는다.**

### 검증 요건

모든 동작 명세에는 아래 세 가지가 충족되어야 한다:

| 요건 | 설명 |
|---|---|
| 직접 분석 | 해당 버전 bundle.js를 직접 읽어 확인한 것 |
| 출처 명시 | `분석 기준: CC v{X.X.X} bundle.js:{line}` 형태로 위치 기재 |
| 재현 가능 | 다른 사람이 같은 bundle.js를 열어 같은 내용을 확인할 수 있어야 함 |

### 절대 금지

- `anthropic-docs/`나 이전 버전 문서를 복사해서 채우는 것
- "아마도", "~일 것이다" 같은 추측 표현
- 출처 없는 동작 주장
- 다른 버전 bundle에서 분석한 내용을 현재 버전 문서에 그대로 적용

### 모르면 명시하라

분석하지 못한 부분은 비워두거나 아래처럼 명시:

```
<!-- TODO: bundle.js:{line 범위} 분석 필요 -->
```

---

## 번들 분석 인용 원칙

cc-gnothi의 분석 대상인 Claude Code 번들은 `© Anthropic PBC. All rights reserved.` 저작물이다.  
문서는 공개 레포(CC BY-NC-SA 4.0)로 배포되므로 아래 원칙을 반드시 따라야 한다.

### 허용

| 항목 | 예시 | 근거 |
|---|---|---|
| 인터페이스 선언 값 | `name: "goal"`, `type: "local-jsx"`, `description: "..."` | 사실·인터페이스 정보 |
| 동작 상수·제한값 | "조건 길이 상한 4000자", "최대 재시도 3회" | 동작 사실 |
| 분석 출처 표기 | `분석 기준: CC v2.1.143 bundle.js:{line}` | 검증 가능성 확보 |
| 의사코드 | 전체 로직을 새로 서술한 것 | 아이디어는 저작권 비보호 |
| Mermaid 흐름도 | 분기·상태 흐름 재작성 | 동일 |

### 금지

| 항목 | 이유 |
|---|---|
| 번들 코드 블록 인용 (어떤 길이든) | 잘린 인용은 문맥 손실 → 오해 유발, 긴 인용은 저작권 침해 |
| 난독화 변수명 그대로 노출 | 원본 식별자 재현 |
| 함수 전체 본문 재현 | 알고리즘 = 핵심 IP |

### 분석 → 문서 변환 흐름

```
번들 전체 함수 읽기 (로컬 분석 전용)
  → 로직 완전 이해
  → 의사코드 or Mermaid로 재작성
  → 동작 사실(상수·제한)만 숫자로 인용
  → 분석 출처 명시
```

**코드 블록을 쓰고 싶다면:** 그것은 의사코드이거나 사용자가 직접 작성하는 예제 코드여야 한다.  
번들에서 그대로 가져온 코드는 길이에 관계없이 금지다.

---

## 금지 사항

- 산문 위주 설명 (테이블/리스트 우선)
- 미검증 코드 예제
- 버전 명시 없는 기능 설명
- 500토큰 이상의 단일 섹션
- 두 개 토픽을 한 파일에 혼재
- 번들 코드 직접 인용 (위 번들 분석 인용 원칙 참고)

---

## 자동화 파이프라인과의 연동

새 버전 artifact가 추가되면 `analyze-artifact` 스크립트가 자동으로 `versions/v{X.X.X}/` 에 초안을 생성한다.

### 자동화가 하는 것

- `versions/v{X.X.X}/{feature}.md` — 신규 기능의 검증된 동작 명세
- `versions/v{X.X.X}/_index.md` — 버전 메타 + **챕터 제안 섹션** 포함

`_index.md`의 챕터 제안 섹션 형식:

```markdown
## 챕터 제안
<!-- 자동화가 채움. 사람이 검토 후 처리 결정. -->
- [ ] `{feature}` — {기능 한 줄 요약}. 기존 챕터 {N}-{name}.md에 흡수 또는 신규 챕터 검토.
```

### 자동화가 절대 하지 않는 것

- `docs/chapters/` 신규 생성 또는 수정
- `docs/reference/` 수정
- `docs/anthropic-docs/` 수정

### 사람이 해야 하는 것 (자동생성 후 검수)

- [ ] 동작 명세가 의사코드/흐름도로만 작성됐는지 (코드 인용 없는지)
- [ ] 동작 사실(상수·제한값) 정확성 — bundle.js에서 직접 확인
- [ ] 분석 출처(`bundle.js:{line}`) 표기 누락 여부
- [ ] `_index.md` 챕터 제안 검토 — 기존 챕터 흡수 / 신규 챕터 생성 / versions/ 유지 중 결정
- [ ] 신규 챕터 필요 시 `docs/chapters/`에 수동 작성

---

<sub>© 2026 ryujaeuk | ryujaeuk@gmail.com | github.com/ryujaeuk/cc-gnothi</sub>
