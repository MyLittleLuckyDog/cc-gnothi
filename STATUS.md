# cc-gnothi 작업 상태

> 마지막 업데이트: 2026-05-31
> 재개 시 이 파일부터 읽을 것. 세부 기술 레퍼런스는 `docs/reference/pipeline.md`.

---

## 한 줄 요약

**Phase 3 진행 중 — Arbor handler-resolution 통합 + nightly 자동화 + library/cache 인프라 완료. 18 버전 (v2.1.132~158) 모두 100% handler resolution.**

(이전: Phase 2 완료 — 전 버전 `_system-context.md` 생성 + MCP query 통합)

---

## 2026-05-31 신규 (다른 세션 작업 — 머지된 PR 5개)

다른 Arbor 측 Claude Code 세션이 이번에 *cc-gnothi 측에 5 PR* 머지함. 다음 세션 재개 시 이 변화부터 확인.

| PR | 머지된 내용 | 영향 |
|---|---|---|
| **#5** `13c5a82` | `analyze-new-version.js` 에 Arbor handler-resolution 자동 wire (4단계: stage → arbor index --save → extract-ast --build-index → arbor-handler-lookup). `versions/v{X}/_index.md` 에 Handler Resolution section, `_handlers.json` 자동 생성. arbor 없으면 graceful SKIP. | new version 분석 시 handler stats 자동. |
| `300e912` | 12 버전 (v2.1.132~149) `_handlers.json` backfill — 모두 100% handler resolution. v2.1.150 (#5 가 만든 첫 버전), v2.1.153~158 (Arbor 측 G1 측정 5 버전) 까지 **18 버전 연속 100%**. | `_handlers.json` 모든 documented 버전에 존재. |
| **#6** `39dc40e` | `nightly/com.cc-gnothi.nightly.plist` template + `nightly/README.md`. macOS launchd 매일 03:00 nightly 자동 (mini-server 시나리오, analysis-only 안전 default). | 사용자가 본인 mini-server 에 install. |
| **#7** `fca5294` | `call-api.js` 에 prompt-cache prefix (` ```json ` fence split) + `X-Session-Id` header for gateway cache continuity. | prereq. 단발 호출에선 cache_read 0 — library 화로 follow-up. |
| **#8** `aa3f21f` | **`scripts/lib/api.js`** 신규 (`makeClient` / `buildCachedContent` / `callApi`) + `scripts/call-api.js` slim cli wrapper + **`scripts/analyze-batch.js`** 신규 (single long-lived client, N cmds sequential). | per-cmd node process boundary 제거, latency 절감. |
| `88a6fd4` | `analyze-batch.js` 의 bash-3.2 호환 fix. | macOS default bash 작동. |
| **#9** `a0ee14d` | `<!-- CACHE_BREAKPOINT -->` marker 추가, `analyze-batch.js` 가 raw template (placeholder 그대로) + per-call substitution tail 패턴. **cache_read 80% hit ratio 입증** (5-cmd batch 의 2~5번이 1988 tokens 모두 read). | 비용 절감 ~8% (uncached JSON 이 prompt 의 대부분이라). 추가 leverage 는 multi-turn 또는 더 큰 cached prefix 시 linearly 증가. |

### Companion claude-gateway change

- **`125314f`** (claude-gateway master) — `X-Session-Id` header 지원 (없으면 기존 UUID-per-request) + `[proxy] max_concurrent = 4` default. `config.toml.example` 신규.
  - 검증: `curl -H 'x-session-id: foo'` 두 번 → 두 번째 cache_read 1313 hit. 두 concurrent request: (1.47s + 3.23s) sequential → (1.38s + 1.59s) parallel.
  - 사용자 mac 의 gateway 는 이미 재시작 + max_concurrent=4 적용 중.

### 새 사용 패턴

**기존**: `./scripts/sync-and-analyze.sh` (자동) 또는 `./scripts/analyze-all.sh --version X.Y.Z` (수동 per-version). 그대로 작동.

**신규 (cache benefit)**: nightly batch 또는 backfill 시:
```bash
node scripts/analyze-batch.js \
    --bundle /path/to/claude-X.Y.Z.js \
    --version X.Y.Z \
    --out-dir versions/vX.Y.Z
```
single long-lived process, cache_read fire, X-Session-Id pinned. `analyze-all.sh` 의 shell-loop 자리에 drop-in.

### 남은 follow-ups (다음 세션 후보)

- `analyze-all.sh` 자체를 `analyze-batch.js` 기반으로 마이그레이션 (현재는 둘 다 공존, sync-and-analyze.sh 가 `analyze-all.sh` 사용).
- nightly launchd 의 wrapper script 에 auto-commit 옵션 추가 (PR #6 의 README 에 opt-in 예시 있음).
- cache_read 의 cost 절감을 늘리려면 `analyze-command.md` template 의 더 큰 cmd-invariant section 을 cached prefix 로 분리. 또는 multi-turn spec generation 패턴.

---

## 한 줄 요약 (이전)

**Phase 2 완료. 전 버전 `_system-context.md` 생성 + MCP query 통합 완료.**

---

## 완료된 것들

### Phase 1 — 슬래시 커맨드 분석

| 항목 | 상태 |
|---|---|
| v2.1.132 ~ v2.1.143 전 버전 spec (85~88개/버전) | ✅ 커밋·푸시 완료 |
| diff 기반 파이프라인 (structural fingerprint, COPY/ANALYZE) | ✅ |
| `sync.sh` cron 자동화 (감지 → 분석 → 커밋·푸시) | ✅ |
| `compare.sh` 버전 간 diff 도구 | ✅ |

### MCP 서버

| 항목 | 상태 |
|---|---|
| Rust 바이너리 (`get_spec`, `list_commands`, `query` 3개 툴) | ✅ |
| `rust-embed` 전 버전 내장 + CC 버전 자동감지 | ✅ |
| MCP end-to-end 테스트 통과 | ✅ |
| Claude Code 로컬 등록 (`cc-gnothi` Connected) | ✅ |

### 배포

| 항목 | 상태 |
|---|---|
| `release.yml` 4플랫폼 CI/CD | ✅ |
| `v0.1.0` 태그 푸시 | ✅ 2026-05-18 |
| GitHub Actions 빌드 | 🔄 빌드 중 (확인: github.com/MyLittleLuckyDog/cc-gnothi/actions) |

---

## 완료된 것들 (Phase 2 추가)

### Phase 2 — 시스템 컨텍스트 분석

| 항목 | 상태 |
|---|---|
| `extract-ast.js --dump-system-context` (3-pass 추출) | ✅ |
| `scripts/analyze-system-context.sh` + 프롬프트 템플릿 | ✅ |
| `versions/v2.1.132~143/_system-context.md` (6개 버전) | ✅ |
| `store.rs` query() doc_type 필터 (system/prompt/hardcoded 키워드) | ✅ |
| MCP query("system prompt hardcoded") 정상 반환 확인 | ✅ |
| list_commands에서 _system-context 제외 확인 | ✅ |

## 대기 중인 것들

### 즉시
- [ ] README.md Phase 2 섹션 업데이트 (system context 분석 기능 소개)

### 배포 생태계
- [ ] MCP Marketplace 등록 검토
- [ ] 신규 CC 버전 감지 → sync.sh cron 실제 검증

---

## 재개 순서

```
1. git pull origin main
2. cat STATUS.md                      ← 지금 이 파일
3. cat docs/reference/pipeline.md     ← 기술 레퍼런스 (스크립트 플래그, spec 포맷 등)
4. tail /tmp/cc-gnothi-sync.log       ← cron 최근 실행 여부
5. 작업 시작
```

---

## 주요 경로

```
REPO      /Volumes/juryu_home/with_AI/projects/0x.tools/cc-gnothi/
AVX2      /Volumes/juryu_home/with_AI/projects/0x.tools/caludeCodeAVX2/  (읽기 전용)
GATEWAY   /Volumes/juryu_home/with_AI/projects/06.DenoV8POC/01.Tools/claude-gateway/
          target/release/claude-agent-rs  (port 8765)
BINARY    REPO/src/target/release/cc-gnothi-mcp
CACHE     ~/.cc-gnothi/cache/  (index-{ver}.json, hashes-{ver}.json)
SYNC_LOG  /tmp/cc-gnothi-sync.log
```

---

## 보안 제약 (변경 불가)

- `caludeCodeAVX2` repo: **읽기 전용**, 절대 쓰지 않음
- 번들 코드 직접 인용 금지 (© Anthropic PBC)
- obfuscated identifier: Appendix 매핑 테이블에만 허용, pseudocode 금지
