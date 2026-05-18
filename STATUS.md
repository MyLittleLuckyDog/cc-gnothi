# cc-gnothi 작업 상태

> 마지막 업데이트: 2026-05-18  
> 재개 시 이 파일부터 읽을 것. 세부 기술 레퍼런스는 `docs/reference/pipeline.md`.

---

## 한 줄 요약

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
