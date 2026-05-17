---
type: reference
source:
  - https://code.claude.com/docs/en/common-workflows
  - https://code.claude.com/docs/en/best-practices
updated: 2026-05-17
stale_risk: high  # 공식 문서 기반. bundle 분석과 충돌 시 bundle 우선.
---

# Claude Code 워크플로우 & 베스트 프랙티스

## 공통 워크플로우

### 1. 새 코드베이스 파악

**목적**: 합류한 프로젝트의 구조와 패턴을 빠르게 이해한다.

**단계**:
1. 프로젝트 루트로 이동 후 `claude` 실행
2. `give me an overview of this codebase` — 전체 구조 파악
3. `explain the main architecture patterns used here` — 아키텍처 패턴
4. `what are the key data models?` / `how is authentication handled?` — 세부 탐색

**팁**:
- 넓은 질문으로 시작해 좁혀 나간다
- 프로젝트 도메인 용어로 질문한다
- 코드 인텔리전스 플러그인을 설치하면 "go to definition" 정확도가 높아진다

---

### 2. 버그 수정

**목적**: 에러 메시지 원인을 찾아 최소한의 변경으로 수정한다.

**단계**:
1. 에러 내용 공유: `I'm seeing an error when I run npm test`
2. 수정 방향 제안 요청: `suggest a few ways to fix the @ts-ignore in user.ts`
3. 수정 적용: `update user.ts to add the null check you suggested`

**팁**:
- 재현 명령어와 스택 트레이스를 함께 제공한다
- 간헐적 에러인지 지속적 에러인지 알린다

---

### 3. 리팩터링

**목적**: 구형 코드를 현대 패턴으로 안전하게 전환한다.

**단계**:
1. 대상 파악: `find deprecated API usage in our codebase`
2. 방향 확인: `suggest how to refactor utils.js to use modern JavaScript features`
3. 변경 적용: `refactor utils.js to use ES2024 features while maintaining the same behavior`
4. 검증: `run tests for the refactored code`

**팁**:
- 하위 호환성 유지가 필요한 경우 명시한다
- 작고 테스트 가능한 단위로 나눠 진행한다

---

### 4. 테스트 작성

**목적**: 미커버 코드에 의미 있는 테스트를 추가한다.

**단계**:
1. 미커버 코드 식별: `find functions in NotificationsService.swift that are not covered by tests`
2. 테스트 스캐폴딩 생성: `add tests for the notification service`
3. 엣지 케이스 추가: `add test cases for edge conditions in the notification service`
4. 실행 및 수정: `run the new tests and fix any failures`

**팁**:
- Claude는 기존 테스트 파일의 스타일·프레임워크·어서션 패턴을 자동으로 맞춘다
- 검증하려는 동작을 구체적으로 명시한다

---

### 5. PR 생성

**목적**: 변경 사항을 요약하고 PR을 작성한다.

**단계**:
1. 변경 요약: `summarize the changes I've made to the authentication module`
2. PR 생성: `create a pr`
3. 설명 보강: `enhance the PR description with more context about the security improvements`

**팁**:
- `gh pr create`로 생성된 PR은 해당 세션과 자동 연결된다
- 이후 `claude --from-pr <number>` 또는 `/resume`으로 돌아올 수 있다
- 제출 전 잠재적 위험을 Claude에게 검토 요청한다

---

### 6. 세션 관리

**목적**: 여러 세션에 걸친 작업을 컨텍스트 손실 없이 이어간다.

**단계**:
1. 가장 최근 세션 재개: `claude --continue`
2. 목록에서 선택: `claude --resume` 또는 실행 중 `/resume`

---

### 7. 병렬 세션 (Worktrees)

**목적**: 서로 충돌 없이 두 가지 작업을 동시에 진행한다.

**단계**:
1. 첫 번째 터미널: `claude --worktree feature-auth`
2. 두 번째 터미널: `claude --worktree bugfix-payment`

각 worktree는 독립된 브랜치 체크아웃이다.

---

### 8. 플랜 모드 (Plan before editing)

**목적**: 디스크 변경 전 계획을 검토한다.

**단계**:
1. 플랜 모드 진입: `claude --permission-mode plan` 또는 세션 중 `Shift+Tab`
2. Claude가 파일을 읽고 계획만 제안 (편집 없음)
3. 승인 후 실행

---

### 9. 서브에이전트 위임

**목적**: 대규모 코드베이스 탐색 시 메인 컨텍스트를 오염시키지 않는다.

**단계**:
1. `use a subagent to investigate how our auth system handles token refresh`
2. 서브에이전트가 별도 컨텍스트에서 탐색 후 요약 보고

---

### 10. 스크립트·CI 파이프라인 연동

**목적**: 비대화형 모드로 CI, pre-commit hook, 배치 처리에 Claude를 통합한다.

**단계**:
1. 단순 파이프: `git log --oneline -20 | claude -p "summarize these recent commits"`
2. JSON 출력: `claude -p "List all API endpoints" --output-format json`
3. 대규모 파일 마이그레이션:
   ```bash
   for file in $(cat files.txt); do
     claude -p "Migrate $file from React to Vue. Return OK or FAIL." \
       --allowedTools "Edit,Bash(git commit *)"
   done
   ```

---

## 베스트 프랙티스

### 검증 기준 제공

| 상황 | 권장 접근 |
|------|-----------|
| 함수 구현 요청 | 예상 입출력 테스트 케이스를 함께 제공하고 구현 후 테스트 실행 지시 |
| UI 변경 | 스크린샷을 붙여넣고 결과 스크린샷과 비교·수정 지시 |
| 빌드 실패 | 에러 메시지 전체를 붙여넣고 "근본 원인을 수정, 에러를 억제하지 말 것" 명시 |

### 컨텍스트 구체적으로 제공

| 상황 | 권장 접근 |
|------|-----------|
| 테스트 추가 | 파일명, 테스트할 시나리오, mock 사용 여부까지 명시 |
| 설계 이유 파악 | git 히스토리를 보도록 지시 (`look through X's git history`) |
| 새 기능 추가 | 유사 기존 구현 파일을 참조 파일로 명시 |
| 버그 수정 | 증상·위치·"수정됐다"는 기준을 함께 제공 |

### CLAUDE.md 관리

| 포함할 것 | 제외할 것 |
|-----------|-----------|
| Claude가 추측할 수 없는 bash 명령어 | 코드를 읽으면 알 수 있는 내용 |
| 기본값과 다른 코드 스타일 규칙 | Claude가 이미 아는 언어 표준 관례 |
| 테스트 실행 방법 | 자주 바뀌는 정보 |
| 브랜치 명명·PR 컨벤션 | 파일별 코드베이스 설명 |
| 프로젝트 특유의 아키텍처 결정 | "클린 코드를 작성하라" 같은 자명한 지침 |

### 컨텍스트 관리

| 상황 | 권장 접근 |
|------|-----------|
| 무관한 작업으로 전환 | `/clear`로 컨텍스트 초기화 |
| 같은 오류를 두 번 이상 수정 중 | `/clear` 후 더 구체적인 프롬프트로 재시작 |
| 코드베이스 대규모 탐색 | 서브에이전트 위임으로 메인 컨텍스트 보존 |
| 빠른 단순 질문 | `/btw` 사용 — 대화 히스토리에 남지 않음 |

### 세션 및 병렬화

| 상황 | 권장 접근 |
|------|-----------|
| 코드 리뷰 품질 향상 | 별도 세션(Writer/Reviewer 패턴): 한 세션이 구현, 다른 세션이 검토 |
| 대규모 마이그레이션 | `claude -p` 루프로 파일별 병렬 처리 |
| 무인 실행 | `claude --permission-mode auto -p "..."` |
| 로컬 파일 접근 필요 | Desktop scheduled tasks |
| 항상 실행 (PC 꺼져도) | Routines (Anthropic 관리 인프라) |

---

## 흔한 실패 패턴과 대처

| 패턴 | 증상 | 대처 |
|------|------|------|
| 잡탕 세션 | 무관한 작업이 같은 컨텍스트에 혼재 | 작업 전환 시 `/clear` |
| 반복 수정 | 같은 문제를 여러 번 수정해도 개선 안 됨 | 두 번 실패 후 `/clear`, 더 구체적인 초기 프롬프트로 재시작 |
| 비대한 CLAUDE.md | Claude가 규칙 일부를 무시 | 불필요 항목 정리; 없어도 Claude가 올바르게 동작하면 삭제 |
| 검증 없는 신뢰 | 그럴듯해 보이지만 엣지 케이스 미처리 | 항상 테스트·스크립트·스크린샷으로 검증 |
| 무한 탐색 | Claude가 수백 개 파일을 읽어 컨텍스트 소진 | 탐색 범위를 좁히거나 서브에이전트에 위임 |
