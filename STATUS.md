# cc-gnothi 작업 상태

> 마지막 업데이트: 2026-05-18  
> 재개 시 이 파일부터 읽을 것. 세부 기술 레퍼런스는 `docs/reference/pipeline.md`.

---

## 한 줄 요약

**Phase 1 완료. MCP v0.1.0 릴리즈됨. Phase 2 (프롬프트 레벨 분석) 대기 중.**

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

## 대기 중인 것들

### 즉시
- [ ] Actions 빌드 결과 확인 (aarch64/x86_64 macOS, Linux, Windows)
- [ ] README.md Install 섹션 — 릴리즈 URL 실제 링크로 업데이트

### Phase 2 — 분석 스코프 확장
슬래시 커맨드 외 **프롬프트 영향 영역** 문서화:
- [ ] `extract-ast.js --dump-system-prompts` 모드 추가
  - agent 초기화 단계 system prompt 추출
  - tool definition 문자열
  - behavioral guard 패턴
- [ ] `versions/v{X}/_system-context.md` 문서 형식 설계
- [ ] `loader.rs` / `store.rs` 새 doc type 지원 추가

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
