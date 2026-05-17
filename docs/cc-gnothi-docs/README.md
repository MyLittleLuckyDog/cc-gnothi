# cc-gnothi

> **CC가 읽는 문서. 사람은 결과만.**  
> Claude Code가 자신의 버전과 기능을 스스로 이해하고 최적 동작하도록 설계된 MCP 기반 자기인식 가이드 시스템.

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![GitHub release](https://img.shields.io/github/v/release/ryujaeuk/cc-gnothi)](https://github.com/ryujaeuk/cc-gnothi/releases)

[English](README.en.md) | 한국어

---

## 컨셉

공식 문서는 잘 쓰여 있다. 문제는 그걸 읽는 게 사람이라는 점이다.

사람이 읽고 이해한 뒤 CC에 전달하는 과정에서 손실이 생긴다.  
cc-gnothi는 그 중간 손실을 제거한다.

```
기존:      문서 → 사람이 읽고 이해 → CC에 지시 → 동작
cc-gnothi: 문서 → CC가 직접 로드/소화 → 최적 동작
                   사람은 결과만 받음
```

> *γνῶθι σεαυτόν — 너 자신을 알라*  
> CC가 자신의 버전, 기능, 한계를 스스로 안다.

---

## 설치

### 플러그인 (권장)

```bash
/plugin marketplace add ryujaeuk/cc-gnothi
/plugin install cc-gnothi@ryujaeuk
```

### 수동

```bash
curl -L https://github.com/ryujaeuk/cc-gnothi/releases/latest/download/cc-gnothi-mcp-$(uname -s)-$(uname -m) \
  -o ~/.claude/bin/cc-gnothi-mcp
chmod +x ~/.claude/bin/cc-gnothi-mcp
```

MCP 설정 (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "cc-gnothi": {
      "command": "~/.claude/bin/cc-gnothi-mcp",
      "transport": "stdio"
    }
  }
}
```

---

## 동작 방식

```
CC 시작
  → cc-gnothi-mcp 실행
  → claude --version 감지
  → 해당 버전 문서 로드 (없으면 GitHub Releases에서 다운로드)
  → QMD 인덱싱
  → MCP 서빙 준비 완료

사용자 질의
  → BM25 + 벡터 검색으로 관련 청크 추출
  → JSON으로 CC 컨텍스트 주입
  → CC가 버전 최적화된 답변 생성
```

---

## 저장소 구조

```
/versions/       버전별 가이드 (v2.x.md)
/chapters/       주제별 챕터
/templates/      문서 작성 템플릿
/src/            cc-gnothi-mcp Rust 소스
```

---

## 버전 인덱스

| CC 버전 | 문서 | 주요 변경 |
|---|---|---|
| 최신 | [releases](https://github.com/ryujaeuk/cc-gnothi/releases) | |

---

## 라이선스

문서: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)  
소스코드: MIT

- 출처 표기 후 비상업적 공유 허용
- 무단 상업적 재배포 금지
- 2차 저작물은 동일 라이선스 적용

---

<sub>
© 2026 ryujaeuk | ryujaeuk@gmail.com  
<a href="https://github.com/ryujaeuk/cc-gnothi">github.com/ryujaeuk/cc-gnothi</a>
</sub>
