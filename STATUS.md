# cc-gnothi 작업 상태

> 마지막 업데이트: 2026-05-18
> 재개 시 이 파일부터 읽을 것

---

## 현재 상태 한 줄 요약

**AST 기반 추출 파이프라인 완성. `clear` spec 1개 verified. 55개 대기 중. claude-gateway PoC 단계.**

---

## Git 상태

- 브랜치: `main`
- 마지막 커밋: `f44d7be feat(docs): add v2.1.132 stubs + batch analysis script`
- 미커밋 변경:
  - `scripts/extract-ast.js` (신규 — AST 인덱스 + 커맨드 추출)
  - `scripts/call-api.js` (신규 — Anthropic SDK, gateway proxy, 429 retry)
  - `scripts/analyze-all.sh` (수정 — call-api.js 사용, 순차 처리)
  - `scripts/prompts/analyze-command.md` (수정 — 툴 없이 JSON 기반 spec 생성)
  - `package.json`, `node_modules/` (신규 — @babel/parser, @anthropic-ai/sdk)
  - `versions/v2.1.132/clear.md` (신규 — verified spec 1개)

---

## 컴포넌트별 상태

### Rust MCP 서버 (`src/`)
| 파일 | 상태 |
|---|---|
| 빌드 | **성공** (경고 3개, 에러 없음) |
| 기능 | `query` 툴 1개 |

### 문서 (`versions/v2.1.132/`)
| 항목 | 상태 |
|---|---|
| stub (55개) | 완료. `bundle_verified: false` |
| **verified spec** | **1개** — `clear.md` (품질 확인됨) |

### AST 파이프라인 (`scripts/`)

| 파일 | 상태 |
|---|---|
| `extract-ast.js` | **완성**. `--build-index` (17780 fn, 84 cmd), `--cmd <name>` (JSON 추출) |
| `call-api.js` | **완성**. gateway proxy 또는 직접 API, 429 retry, usage 로깅 |
| `analyze-all.sh` | **완성**. 순차 처리, AST JSON → prompt embed → call-api.js |
| `prompts/analyze-command.md` | **완성**. 툴 없이 JSON만으로 spec 생성 |
| AST 인덱스 캐시 | `~/.cc-gnothi/cache/index-2.1.132.json` (빌드 완료) |

---

## 즉시 재개 순서

```
1. claude-gateway 빌드 및 실행:
   cd /Volumes/juryu_home/with_AI/projects/06.DenoV8POC/01.Tools/claude-gateway
   cargo build --release
   ./target/release/server

2. 단독 테스트:
   cd /Volumes/juryu_home/with_AI/projects/0x.tools/cc-gnothi
   bash scripts/analyze-all.sh --cmd add-dir --version 2.1.132

3. 성공 확인 후 배치 (55개):
   bash scripts/analyze-all.sh --version 2.1.132

4. 배치 완료 후 MCP 실제 테스트
```

---

## 핵심 설계 변경 (v2 파이프라인)

| 항목 | 이전 | 현재 |
|---|---|---|
| 분석 방식 | `claude -p` + grep/Read 번들 | AST 추출 → JSON → Claude 해석만 |
| API 호출 | `claude -p` (subprocess) | `@anthropic-ai/sdk` → gateway proxy |
| 병렬 처리 | xargs -P 5 | 순차 (rate limit 대응) |
| Write 툴 버그 | 발생 가능 | 구조적 해소 (툴 없음) |
| 결과물 품질 | LLM 추측 가능 | AST 사실 기반 (byte citation) |

---

## 주요 설계 결정 (기록)

- **라이선스**: AGPL-3.0-only (Anthropic PBC 번들 저작권 별도 명시)
- **문서 언어**: CC가 참고할 MD는 영문, 사용자 피드백은 한국어
- **번들 분석 방식**: @babel/parser AST (14MB, Bun CJS, 3.3s parse, 17780 fn)
- **AST JSON 크기**: depth=2 기준 ~20KB/커맨드 → Claude 프롬프트에 직접 임베드
- **obfuscated identifier**: Appendix 매핑 테이블에만 허용, pseudocode 금지
- **gateway**: `/v1/messages` proxy (OAuth 기반, API 키 불필요)

---

## 파일 위치 참조

```
/Volumes/juryu_home/with_AI/projects/0x.tools/cc-gnothi/   ← 메인 repo
  scripts/
    extract-ast.js          ← AST 인덱스 빌드 + 커맨드 추출
    call-api.js             ← API 호출 (gateway or direct)
    analyze-all.sh          ← 배치 파이프라인
    prompts/analyze-command.md
  versions/v2.1.132/        ← spec 문서 (1 verified, 55 stub)

/Volumes/juryu_home/with_AI/projects/0x.tools/caludeCodeAVX2/artifacts/
  claude-2.1.132.js         ← 분석 대상 번들 (14MB, 읽기 전용)

/Volumes/juryu_home/with_AI/projects/06.DenoV8POC/01.Tools/claude-gateway/
  src/                      ← Rust gateway source
  target/release/server     ← 빌드 필요

~/.cc-gnothi/cache/
  index-2.1.132.json        ← AST 인덱스 (17780 fn, 84 cmd)
```
