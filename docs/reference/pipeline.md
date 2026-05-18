---
title: "cc-gnothi 파이프라인 레퍼런스"
updated: "2026-05-18"
audience: "Claude (개발 세션 재개용)"
---

# cc-gnothi 파이프라인 레퍼런스

> 새 세션 시작 시 이 파일을 먼저 읽을 것.  
> 코드 작성 전 반드시 수정 대상 파일을 직접 Read할 것.

---

## 1. 전체 데이터 흐름

```
caludeCodeAVX2/artifacts/claude-{ver}.js          ← 읽기 전용 (© Anthropic PBC)
  │
  ├─ extract-ast.js --build-index                  → ~/.cc-gnothi/cache/index-{ver}.json
  ├─ extract-ast.js --hash-commands                → ~/.cc-gnothi/cache/hashes-{ver}.json
  └─ extract-ast.js --cmd <name>                   → stdout JSON (analyze_command에서 캡처)
       │
  analyze-all.sh --version V --from-version PREV
       │  COPY: hash 동일 → copy_from_version (frontmatter만 업데이트)
       └─ ANALYZE: hash 변경 → call-api.js → claude-gateway:8765 → spec markdown
                                                   → versions/v{V}/{command}.md
  sync.sh (cron: 17 */6 * * *)
       → git pull → hash diff → analyze-all.sh → git commit + push
```

---

## 2. 스크립트 CLI 레퍼런스

### `scripts/extract-ast.js`

| 모드 | 플래그 조합 | 출력 |
|---|---|---|
| 인덱스 빌드 | `--build-index --bundle <path> --version <ver>` | `~/.cc-gnothi/cache/index-{ver}.json` |
| 커맨드 추출 | `--cmd <name> --bundle <path> --index <path> [--depth N]` | stdout JSON |
| 해시 생성 | `--hash-commands --bundle <path> --version <ver>` | `~/.cc-gnothi/cache/hashes-{ver}.json` |

- `--depth`: BFS 탐색 깊이 (기본 2)
- 캐시 자동 재사용: index/hash 파일이 있으면 skip

### `scripts/call-api.js`

```bash
node scripts/call-api.js \
  --prompt-file <path>     # 프롬프트 파일 (JSON 임베드 포함)
  [--model claude-sonnet-4-6]
  [--max-tokens 8192]
```

- 환경변수: `CLAUDE_GATEWAY_URL` (기본 `http://localhost:8765`) 또는 `ANTHROPIC_API_KEY`
- 429 응답 시 `resets_at` 필드 파싱 → 자동 sleep 후 재시도

### `scripts/analyze-all.sh`

```bash
bash scripts/analyze-all.sh \
  [--version X.X.X]        # 기본: 2.1.132
  [--from-version X.X.X]   # diff 모드 — 지정 시 해시 비교 후 COPY/ANALYZE 분류
  [--cmd NAME]              # 단일 커맨드 모드
  [--dry-run]               # 실제 API 호출 없이 COPY/ANALYZE 분류만 출력
  [--depth N]               # AST BFS 깊이
```

### `scripts/compare.sh`

```bash
bash scripts/compare.sh <from-ver> <to-ver>
# 예: bash scripts/compare.sh 2.1.141 2.1.142
# 출력: CHANGED / ADDED / REMOVED / SAME 커맨드 목록 (해시 기반, 즉시)
# 전제조건: ~/.cc-gnothi/cache/hashes-{ver}.json 존재
```

### `scripts/sync.sh`

- lockfile: `/tmp/cc-gnothi-sync.lock`
- log: `/tmp/cc-gnothi-sync.log`
- gateway: `GATEWAY_BIN` 미실행 시 자동 시작
- analyzed 판정: `git grep -l "^bundle_verified: true" -- "versions/v*/*.md"` (stub 오탐 방지)
- bash 3.2 호환: `mapfile` 금지, `declare -A` 금지 → while-read + string grep 사용

---

## 3. 구조적 핑거프린트 (Structural Fingerprint)

Bun 빌드마다 식별자가 로테이션되므로 raw byte hash는 버전 비교에 무의미.  
커맨드 동작의 안정적 시그니처는 **string literal + telemetry event**만으로 구성.

```
sig = sorted(string_literals ∪ telemetry_events).join("|")
hash = SHA256(sig)[0:16]  # 16자 hex
```

- string literal: `StringLiteral` AST 노드 (값이 obfuscated identifier가 아닌 것)
- telemetry event: `"tengu_"` prefix string (절대 minification되지 않음)
- v141→v142 검증: 85/85 hash 동일 → 커맨드 레벨 변경 없는 hotfix 확인

---

## 4. Spec 문서 형식

### Frontmatter 필수 필드

```yaml
---
type: feature-spec
feature: "<command-name>"
cc_version: "X.X.X"
updated: "YYYY-MM-DD"
tags: ["<name>", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true          # ← 분석 완료된 것만 true
analysis_basis: "CC vX.X.X bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---
```

COPY된 파일 추가 필드:
```yaml
inherited_from: "X.X.X"       # 원본 버전
```

### 섹션 순서 (SECTION_ORDER in store.rs)

1. Overview
2. Registration
3. Input Branching
4. Behavioral Spec
5. State & Side Effects
6. Version History
7. Common Mistakes
8. **Appendix — Identifier Mapping** ← MCP query에서 기본 제외 ("identifier"/"appendix" 쿼리 시만 포함)

### 보안 제약

- 번들 코드 직접 인용 금지 (© Anthropic PBC)
- obfuscated identifier (`mw8`, `QI7` 등): **Appendix 매핑 테이블에만** 허용
- pseudocode, prose, Mermaid 다이어그램에 obfuscated identifier 사용 금지
- `caludeCodeAVX2` repo: 읽기 전용, 절대 쓰지 않음

---

## 5. Rust MCP 서버 (`src/`)

### 파일 역할

| 파일 | 역할 |
|---|---|
| `embedded.rs` | `rust-embed` `VersionedSpecs` 구조체 — `../versions/` 하위 `v*/*.md` 임베드 |
| `loader.rs` | `load_all(dir)`, `load_embedded(ver)`, `load_str()` — Chunk 파싱 |
| `store.rs` | `get_spec()`, `list_commands()`, `query()` — QMD 스코어 기반 검색 |
| `server.rs` | `rmcp` tool 핸들러 — `get_spec`, `list_commands`, `query` |
| `main.rs` | 진입점 — CC 버전 자동 감지, `--docs`/`--cc-version`/`--fetch` args 파싱 |
| `fetcher.rs` | (예비) GitHub API fallback |

### 핵심 상수 (store.rs)

```rust
const CONTENT_PREVIEW_CHARS: usize = 4000;   // query 결과 본문 미리보기 최대
const GET_SPEC_MAX_CHARS: usize = 15_000;    // get_spec 전체 출력 최대
```

### rust-embed 설정 (embedded.rs)

```rust
#[derive(RustEmbed)]
#[folder = "../versions/"]
#[include = "v*/*.md"]
pub struct VersionedSpecs;
```

Cargo.toml:
```toml
rust-embed = { version = "8", features = ["compression", "include-exclude"] }
```

`iter()` / `get()` 호출 시 반드시:
```rust
use rust_embed::Embed as _;
```

### CC 버전 자동 감지 (main.rs)

```rust
Command::new("claude").arg("--version").output()
// "Claude Code 2.1.143" → "2.1.143" 파싱
// 실패 시 latest_embedded_version() fallback + warning
```

### QMD 스코어 가중치 (store.rs)

| 매칭 위치 | 가중치 |
|---|---|
| heading | 8 |
| feature | 6 |
| tags | 4 |
| body | 1 |
| 버전 정확 일치 보너스 | +10 |

---

## 6. 주요 파일 경로

```
REPO_ROOT = /Volumes/juryu_home/with_AI/projects/0x.tools/cc-gnothi/
AVX2_REPO = /Volumes/juryu_home/with_AI/projects/0x.tools/caludeCodeAVX2/   (읽기 전용)
ARTIFACTS = AVX2_REPO/artifacts/claude-{ver}.js
GATEWAY   = /Volumes/juryu_home/with_AI/projects/06.DenoV8POC/01.Tools/claude-gateway/
              target/release/claude-agent-rs  (port 8765)
CACHE     = ~/.cc-gnothi/cache/
  index-{ver}.json       ← AST 인덱스 (17,000+ 함수)
  hashes-{ver}.json      ← 커맨드 구조 해시 ({"version":"X","commands":{...}})
VERSIONS  = REPO_ROOT/versions/v{X.X.X}/{command}.md
SYNC_LOG  = /tmp/cc-gnothi-sync.log
LOCK      = /tmp/cc-gnothi-sync.lock
```

---

## 7. 버전별 diff 요약

| 구간 | COPY | ANALYZE | 비고 |
|---|---|---|---|
| 132→133 | 59 | 25 | |
| 133→139 | 26 | 59 | |
| 139→141 | 미확인 | 미확인 | |
| 141→142 | 85 | 0 | 커맨드 레벨 변경 없는 hotfix |
| 142→143 | 25 | 60 | |

---

## 8. Phase 2 계획 (Phase 1 완료 후)

슬래시 커맨드 외 **프롬프트 영향 영역** 분석:

- `extract-ast.js --dump-system-prompts`: 일정 길이 이상 string literal 중 behavioral instruction 패턴 필터
- 출력: `versions/v{X}/_system-context.md`
- 커버 대상: system prompt, tool definition 문자열, behavioral guard, context window 관리 로직

Phase 1 정의: v2.1.143까지 모든 슬래시 커맨드 spec 완료 + Rust 바이너리 빌드 + CI/CD release.yml 연결.
