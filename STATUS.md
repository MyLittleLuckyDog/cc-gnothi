# cc-gnothi 작업 상태

> 마지막 업데이트: 2026-05-18
> 재개 시 이 파일부터 읽을 것

---

## 현재 상태 한 줄 요약

**MCP walking skeleton 빌드 완료, 문서 stub 56개 생성 완료, 배치 분석 파이프라인 미완성.**

---

## Git 상태

- 브랜치: `main`, origin과 동기화 완료
- 마지막 커밋: `f44d7be feat(docs): add v2.1.132 stubs + batch analysis script`
- 커밋 이력:
  ```
  f44d7be feat(docs): add v2.1.132 stubs + batch analysis script
  af79656 feat(mcp): add Rust MCP walking skeleton + update license and prompt
  f092e09 docs: add README and CC BY-NC-SA 4.0 license
  0eceef2 feat: initial commit — cc-gnothi workspace
  ```

---

## 컴포넌트별 상태

### Rust MCP 서버 (`src/`)

| 파일 | 상태 |
|---|---|
| `Cargo.toml` | 완료. rmcp 1.7.0, schemars 1.0, reqwest, walkdir |
| `main.rs` | 완료. `--cc-version`, `--docs`, `--fetch` args, stdio transport |
| `loader.rs` | 완료. MD→Chunk (frontmatter + section 단위) |
| `store.rs` | 완료. QMD 스코어링 (heading 8, feature 6, tags 4, body 1, version +10) |
| `fetcher.rs` | 완료. GitHub API tree + SHA 캐시 (`~/.cc-gnothi/cache/`) |
| `server.rs` | 완료. rmcp `query` 툴 1개 |
| **빌드** | **성공** (경고 3개, 에러 없음) |

### 문서 (`versions/v2.1.132/`)

| 항목 | 상태 |
|---|---|
| `_index.md` | 완료. 56개 커맨드 목록, 영문 |
| stub `.md` (56개) | 완료. Registration만, `bundle_verified: false` |
| **verified spec** | **0개** — 배치 분석 미완성 |

### 스크립트

| 파일 | 상태 |
|---|---|
| `analyze-new-version.js` | 완료. 영문 stub 생성 |
| `analyze-all.sh` | 완료. 파이프라인 작성됨, **출력 포맷 버그 있음** |
| `prompts/analyze-command.md` | 완료. 영문, rule 5 강화됨 |

---

## 핵심 미해결 이슈

### ① analyze-all.sh 출력 포맷 버그 (최우선)

**증상**: `claude -p`에 `--allowed-tools "Bash Read"` 줘도, claude가 분석은 제대로 하고 Write 툴로 파일 저장을 시도 → stdout에 permission 요청 텍스트가 나옴 → validation 실패.

**증거**: `/tmp/cc-gnothi-clear-FAILED.md` 내용 =
```
The write is waiting for your permission to overwrite the existing file...
- 12 ordered phases — SessionEnd hooks → ... (올바른 분석 내용)
- SessionEnd hook timeout — clamped to [1500ms, 60000ms]
- 35 obfuscated identifier mappings
```
→ **분석 자체는 정확함.** 출력 경로만 잘못됨.

**수정 방향**:
- `analyze-command.md` 프롬프트에 더 강한 지시 추가:
  > "Write/Edit tools are disabled. You MUST output the raw markdown directly to stdout as your response text. Any permission request or file-save attempt is a failure."
- `--output-format text` 확인 (이미 default이지만 명시)
- 또는: 프롬프트 마지막에 "Now output the markdown:" 같은 강제 유도어 추가

### ② npm 권한 문제 (선택)

```bash
sudo chown -R $(whoami) ~/.npm
```
실행 후 `npm install -g js-beautify` 가능 → 번들 readable 변환 옵션 생김.
현재는 grep+Read로 분석 가능함이 확인됨 (clear 분석 내용이 정확했음).

### ③ MCP 미완성 기능 (문서 완성 후)

- See Also 1-hop 링크 확장 (Store에서 linked spec Overview 자동 추가)
- GitHub 인증 토큰 옵션
- `CC_VERSION` 환경변수 fallback 전략

---

## 즉시 재개 순서

```
1. analyze-command.md 프롬프트 수정 (Write 툴 금지 강화)
2. clear 단독 테스트: bash scripts/analyze-all.sh --cmd clear --version 2.1.132
3. 성공 확인 후 배치: bash scripts/analyze-all.sh --version 2.1.132 --parallel 5
   (예상 시간: 56개 × ~7분 / 5병렬 = ~80분)
4. 배치 완료 후 MCP fetcher 실제 테스트
```

---

## 주요 설계 결정 (기록)

- **라이선스**: AGPL-3.0-only (Anthropic PBC 번들 저작권 별도 명시)
- **문서 언어**: CC가 참고할 MD는 영문, 사용자 피드백은 한국어
- **번들 분석 방식**: grep + Read (14MB, 19K줄, 평균 734자/라인). 작동 확인됨.
- **그래프 검색**: 현 단계 불필요. 문서 충분해지면 See Also 1-hop 확장으로 커버.
- **MCP 툴 수**: `query` 1개. `list_commands` / `get_spec` 추가는 나중.
- **obfuscated identifier**: Appendix 매핑 테이블에만 허용, pseudocode에 절대 금지.

---

## 파일 위치 참조

```
/Volumes/juryu_home/with_AI/projects/0x.tools/cc-gnothi/   ← 메인 repo
  src/                  ← Rust MCP 서버
  scripts/
    analyze-all.sh      ← 배치 분석 스크립트
    analyze-new-version.js
    prompts/analyze-command.md  ← claude -p 프롬프트 템플릿
  versions/v2.1.132/    ← stub 문서 56개

/Volumes/juryu_home/with_AI/projects/0x.tools/caludeCodeAVX2/artifacts/
  claude-2.1.132.js     ← 분석 대상 번들 (14MB, 읽기 전용)

/tmp/cc-gnothi-clear-FAILED.md  ← clear 분석 결과 (내용은 정확함, 형식 실패)
```
