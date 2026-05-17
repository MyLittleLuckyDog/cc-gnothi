# `/goal` 명령 — Ralph-loop 구현 분석 (Claude Code 2.1.139)

추출 대상: `extract/bundle.js` (Claude Code 2.1.139 번들, 14.36 MB / 19,398 줄)
번들 메타: `VERSION: "2.1.139"`, `BUILD_TIME: 2026-05-11T17:03:24Z`, `GIT_SHA: 208bf4b44f987c4c62618ae20ce1715d53693c62`

`/goal <조건>` 은 사용자가 지정한 자연어 조건이 충족될 때까지 어시스턴트가 멈추지 못하게 하는 **session-scoped Stop hook** 을 등록한다. 이게 곧 Claude Code 내부의 ralph-loop 본체다.

---

## 1. 명령 등록 (bundle.js:7680)

```js
QI7 = {
  type: "local-jsx", name: "goal",
  description: "Set a goal — keep working until the condition is met",
  argumentHint: "[<condition> | clear]",
  immediate: true, load: () => …       // 메시지 모듈 m0q
}
dI7 = {                                  // non-interactive 변형
  type: "local", name: "goal",
  supportsNonInteractive: true,
  thinClientDispatch: "post-text",
  isHidden: !T_(),
  isEnabled: () => T_() || I_(),
  load: () => …                          // U0q (B0q 의 default export)
}
cI7 = QI7                                // 기본 export
```

`type:"local-jsx"` 는 React 인라인 UI 컴포넌트로 즉시 결과를 반환, `type:"local"` 은 -p / 비대화형 모드.

---

## 2. 입력 분기 (bundle.js:7680, `B0q` 모듈)

```js
// 인자 없음 → 현재 goal 상태 출력
if (!A.trim()) {
  let K = yYq(messages);                  // 최근 met=true (sentinel 제외) goal 찾기
  let L = `${K.iterations} iter, ${dur}, ${tok} tokens`;
  let f = K.lastReason ? `\n${hYq(K.lastReason)}` : "";
  return {type:"text", value:`Goal active: ${K.condition} (${L})${f}`};
}

// clear / stop / off / reset / none / cancel
if (mw8(A)) {
  let K = zoH(_);                         // 훅 제거, activeGoal 초기화
  return {type:"text", value: K===null ? "No goal set" : `Goal cleared: ${K}`};
}

// 길이 검사 ($oH = 4000)
if (A.length > $oH) {
  Y8("goal_set","too_long");
  return {type:"text", value:`Goal condition is limited to ${$oH} characters (got ${A.length})`};
}

// 등록
let q = OoH(A, _);
if (q !== null) return {type:"text", value:q};   // 정책/신뢰 게이트 실패 메시지
return {
  type: "query",
  value: `Goal set: ${A}`,
  prompt: pw8(A)                          // ← LLM 에게 보내는 시드 프롬프트
};
```

핵심 상수:
- `$oH = 4000` — 조건 길이 상한
- `i27 = new Set(["clear","stop","off","reset","none","cancel"])` — clear 키워드
- `r27` — trust gate 실패 메시지
- `o27` — policy gate 실패 메시지 (`disableAllHooks`)

---

## 3. 사용자 → 메인 LLM 으로 가는 시드 프롬프트 (`pw8`)

```text
A session-scoped Stop hook is now active with condition: "<조건>".
Briefly acknowledge the goal, then immediately start (or continue)
working toward it — treat the condition itself as your directive
and do not pause to ask the user what to do.
The hook will block stopping until the condition holds.
It auto-clears once the condition is met — do not tell the user
to run `/goal clear` after success; that's only for clearing a
goal early.
```

---

## 4. Stop 훅 등록 (`OoH`) / 해제 (`zoH`)

```js
// OoH(condition, ctx)
function OoH(H, _) {
  const A = Wu_();                          // 게이트 체크
  if (A !== null) { Y8("goal_set", A.code); return A.message; }

  const q = V6();                           // cwd
  // 기존 Stop prompt hook 모두 제거 (한 번에 하나만 유지)
  for (const L of Uw8(_.getAppState(), q))
    _.sessionHooksRegistry.remove(q, "Stop", L);

  _.sessionHooksRegistry.add(q, "Stop", "", { type: "prompt", prompt: H });

  const K = { condition: H, iterations: 0, setAt: Date.now(), tokensAtStart: Gj() };
  _.setAppState((L) => ({ ...L, activeGoal: K }));
  _.applyMessageOp({ type:"append", messages:[ SYq(false, H) ] });   // sentinel attachment
  Q("tengu_stop_hook_added", { promptLength: H.length, via:"goal" });
  kH("goal_set");                           // 알림음
  return null;
}

// zoH(ctx) — 훅 + activeGoal 정리, 클리어 attachment 부착
// Wu_()  — disableAllHooks 정책이면 차단, trusted workspace 아니면 차단
// Uw8()  — Stop event 중 matcher 빈 prompt-type 훅만 골라냄 (skillRoot 없는 것만)
// SYq()  — goal_status attachment 생성
// yYq()  — 메시지 히스토리에서 met=true 인 goal_status 역방향 검색
// hYq()  — "Last check: <reason>" 포맷
```

---

## 5. **Ralph-loop 본체** (bundle.js:4451)

매번 어시스턴트가 멈추려고 하면 호출되는 Stop hook 평가 결과 처리 루프. `V` 는 Stop hook executor 스트림.

```js
for await (let b of V) {
  if (b.message) {
    yield b.message;

    if (b.message.type === "attachment") {
      const y = b.message.attachment;

      if ("hookEvent" in y && (y.hookEvent === "Stop" || y.hookEvent === "SubagentStop")) {

        // 조건 충족 → 훅 제거 + goal 종료
        if (y.type === "hook_success") {
          const m = T(b.hook);
          if (y.hookEvent === "Stop" && m) {
            L.sessionHooksRegistry.remove(V6(), "Stop", m);
            const F = L.getAppState().activeGoal;
            if (F?.condition === m.prompt) {
              const g = F.iterations + 1;
              const c = Date.now() - F.setAt;
              const l = Gj() - F.tokensAtStart;
              yield { type:"active_goal", value: undefined };
              yield M9({
                type:"goal_status", met:true,
                condition: m.prompt, reason: b.stopReason,
                iterations: g, durationMs: c, tokens: l
              });
              Q("tengu_goal_achieved", { promptLength:m.prompt.length, iterations:g, durationMs:c, tokens:l });
              kH("goal_met");
            }
          }
        }

        // 훅 비-blocking 에러
        else if (y.type === "hook_non_blocking_error" || y.type === "hook_error_during_execution") {
          C.push(y.stderr || y.content || `Exit code ${y.exitCode}`); R = true;
        }
      }
    }
  }

  // 조건 미충족 → blockingError → 메인 루프가 한 턴 더 굴림
  if (b.blockingError) {
    const y = $8({ content: oI_(b.blockingError), isMeta: true });
    X.push(y); yield y; R = true;

    const m = T(b.hook);
    const F = L.getAppState().activeGoal;
    if (m && F?.condition === m.prompt) {
      yield { type:"active_goal",
              value: { ...F, iterations: F.iterations + 1, lastReason: b.stopReason } };
      yield M9({ type:"goal_status", met:false, condition: m.prompt, reason: b.stopReason });
    } else {
      C.push(b.blockingError.blockingError);
    }
  }

  // evaluator 실패 등으로 평가 자체 불가 → 진짜 중단
  if (b.preventContinuation) {
    S = true;
    h = b.stopReason || "Stop hook prevented continuation";
    yield M9({ type:"hook_stopped_continuation", message:h,
               hookName:"Stop", toolUseID:Z, hookEvent:"Stop" });
  }

  if (L.abortController.signal.aborted) { … }
}
```

**핵심 메커니즘**

- 성공(`hook_success`) → `goal_status met:true` 부착 + activeGoal 클리어 → 종료
- 실패(`blockingError`) → `iterations++`, `lastReason` 갱신 → blockingError 메시지가 다음 사용자 턴에 합쳐져 메인 루프 자동 재진입
- 평가 실패(`preventContinuation`) → 사용자가 끼어들 때까지 멈춤

---

## 6. Prompt-type Stop hook evaluator (bundle.js:8836~8849, `lEq`)

조건이 충족됐는지 LLM 에게 묻는 부분. **이게 ralph-loop 의 판정자(judge)다.**

### 6-1. evaluator 에게 가는 사용자 메시지

```js
const O = (A === "Stop" || A === "SubagentStop");
const z = O
  ? `Based on the conversation transcript above, has the following stopping condition been satisfied? Answer based on transcript evidence only.

Condition: ${H.prompt}`
  : H.prompt;
```

### 6-2. System prompt — Stop / SubagentStop (`O === true`)

```text
You are evaluating a stop-condition hook in Claude Code. Read the
conversation transcript carefully, then judge whether the user-provided
condition is satisfied.

Your response must be a JSON object with one of these shapes:
- {"ok": true, "reason": "<quote evidence from the transcript that satisfies the condition>"}
- {"ok": false, "reason": "<quote what is missing or what blocks the condition>"}

Always include a "reason" field, quoting specific text from the
transcript whenever possible. If the transcript does not contain clear
evidence that the condition is satisfied, return
{"ok": false, "reason": "insufficient evidence in transcript"}.
```

### 6-3. System prompt — 그 외 훅 (`O === false`)

```text
You are evaluating a hook condition in Claude Code. Judge whether the
user-provided condition is met.

Your response must be a JSON object with one of these shapes:
- {"ok": true, "reason": "<reason the condition is met>"}
- {"ok": false, "reason": "<reason the condition is not met>"}

Always include a "reason" field.
```

### 6-4. evaluator 호출 옵션

```js
hvH({
  messages: [...truncatedTranscript, userMessage],
  systemPrompt: cq([ … ]),                          // 6-2 또는 6-3
  thinkingConfig: { type: "disabled" },             // thinking 끔
  tools: [],                                        // 도구 없음
  signal: P,                                        // 30s 타임아웃
  options: {
    model: H.model ?? mj(),                         // 기본 메인 모델
    isNonInteractiveSession: true,
    querySource: "hook_prompt",
    outputFormat: {
      type: "json_schema",
      schema: {
        type: "object",
        properties: { ok:{type:"boolean"}, reason:{type:"string"} },
        required: ["ok","reason"],
        additionalProperties: false
      }
    }
  }
})
```

기본 타임아웃 30,000 ms (`H.timeout ?? 30`)

### 6-5. Transcript truncation (`Iy7`, bundle.js:8858)

context window 의 70% (`Ey7 = 0.7`) 를 예산으로 사용자 메시지 단위 그룹부터 오래된 순으로 잘라냄. 잘린 경우 다음 메타 메시지를 prepend:

```text
[Earlier conversation truncated to fit the hook evaluator's context
window — N earlier messages omitted. Evaluate the condition against
the recent transcript below; if the required evidence may be in the
omitted prefix, return {"ok": false, "reason": "insufficient evidence
in transcript"}.]
```

텔레메트리: `tengu_hook_prompt_transcript_truncated`

### 6-6. 결과 매핑

| evaluator 응답 | outcome | preventContinuation | 효과 |
|---|---|---|---|
| `ok:true` | `success` | false | `hook_success` attachment → 메인 루프 4451 에서 goal met 처리 |
| `ok:false` (Stop) | `blocking` | **false** | `iterations++`, 다음 턴 자동 진행 (← 루프) |
| `ok:false` (non-Stop) | `blocking` | `!H.continueOnBlock` | 진짜 차단 |
| JSON 파싱 실패 / 스키마 mismatch | `non_blocking_error` | — | 에러 메시지만 출력 |
| API error | `non_blocking_error` | — | |
| timeout / abort | `cancelled` | — | |

---

## 7. Agent evaluator (bundle.js:8850~8858, `iEq`) — 대체 모드

`H` 에 `type:"agent"` 같은 변형이면 inline 대신 **transcript 를 파일 경로로 넘기고 도구 사용을 허용하는 별도 미니 에이전트**가 검증한다.

System prompt 분기:
```text
You are verifying a stop condition in Claude Code.
Your task is to verify that the agent completed the given plan.

(또는 비-Stop 훅:)
You are evaluating a ${event} hook in Claude Code.
Your task is to evaluate the condition described in the user message.
```

이어지는 본문:
```text
The conversation transcript is available at: ${transcriptPath}
You can read this file to analyze the conversation history if needed.

Use the available tools to inspect the codebase and verify the condition.
Use as few steps as possible - be efficient and direct.

When done, return your result using the ${uG} tool with:
- ok: true if the condition is met
- ok: false with reason if the condition is not met
```

핵심 차이:
- 타임아웃 60s, max **50 turns** (`tengu_agent_stop_hook_max_turns`)
- 도구 풀: `L.options.tools` 에서 일부 차단 도구만 제외, 끝에 `dEq()` (결과 반환용 verify 도구) 추가
- 권한: `mode:"dontAsk"` + `Read(/${transcriptPath})` 세션 권한 자동 부여
- 결과 채널: `attachment.type === "structured_output"` 으로 `{ok, reason}` 수집되면 즉시 abort

---

## 8. UI / 디스플레이 (bundle.js:3037)

`goal_status` attachment 렌더링:
- `sentinel:true` → 렌더 스킵 (등록/해제 표시용 더미)
- `met:true` → `Goal active` 위/아래에 duration, iterations 표시
- `met:false` + reason → `Last check: …` 라인 추가
- `Goal cleared: …` / `Goal set: …` 등 텍스트 메시지는 메인 메시지 스트림으로 별도

`/loops` 명령 (현재 `isEnabled:false`, bundle.js:7680~ `vYq`/`t27`) 은 cron + stop-hook 통합 UI 로 같은 `OoH`/`zoH` 를 호출. interval/until 모드 전환, "every 10m" 같은 자연어 인터벌 파싱(`s27`) 포함.

---

## 9. 세션 복구 / activeGoal 추적

bundle.js:9354 의 `Amq(messages)` 가 메시지 히스토리에서 마지막 미달성 goal condition 을 역방향 검색, `Vg7(H,_)` 가 정책 게이트와 함께 호출됨. 세션을 `--continue` 로 이어 받을 때 미달성 goal 을 다시 인지하는 경로로 보임.

텔레메트리 이벤트 모음:
- `tengu_stop_hook_added` (`via:"goal"`)
- `tengu_stop_hook_removed` (`via:"goal"`)
- `tengu_goal_achieved` (promptLength, iterations, durationMs, tokens)
- `tengu_goal_command`
- `tengu_hook_prompt_transcript_truncated`
- `tengu_agent_stop_hook_max_turns` / `_success` / `_blocking` / `_error`

---

## 10. 사용 시 동작 정리

1. `/goal 테스트가 통과할 때까지`
2. `OoH` 가 Stop hook 등록, `activeGoal` 세팅
3. 메인 LLM 에 `pw8` 시드 프롬프트 전달 → 작업 시작
4. 어시스턴트가 한 턴 끝내고 멈추려 함 → Stop hook 발동
5. `lEq` evaluator: 6-2 system prompt + 최근 transcript → `{ok, reason}` JSON 강제
6. `ok:false` → blockingError → `iterations++`, lastReason 갱신, 다음 턴 자동 진행
7. `ok:true` → `hook_success` → 4451 라인에서 훅 제거 + `activeGoal` 클리어 + 종 소리

**ralph 재현 시 필수 재현 대상**: 5번 블록 + 6-2 evaluator 시스템 프롬프트 + `outputFormat: json_schema` 강제 + 70% transcript truncation + iteration 카운터.

---

## Appendix — 식별자 매핑

| 코드 식별자 | 역할 |
|---|---|
| `QI7` / `dI7` / `cI7` | /goal 명령 정의 (jsx / non-interactive / default) |
| `pw8(H)` | 메인 LLM 시드 프롬프트 빌더 |
| `OoH(H, _)` | Stop 훅 등록 + activeGoal 세팅 |
| `zoH(_)` | Stop 훅 해제 + activeGoal 클리어 |
| `mw8(A)` | clear/stop/off/reset/none/cancel 판별 |
| `yYq(messages)` | 최근 met goal_status 검색 |
| `SYq(met, condition)` | goal_status sentinel attachment 생성 |
| `hYq(reason)` | "Last check: …" 포맷 |
| `Uw8(state, cwd)` | Stop event의 prompt-type 훅 추출 |
| `Wu_()` | trust + policy 게이트 |
| `Amq(messages)` | 세션 히스토리에서 미달성 goal 검색 |
| `lEq(...)` | **prompt-type Stop hook evaluator (inline)** |
| `iEq(...)` | **agent-type Stop hook evaluator (tools+transcript file)** |
| `Iy7(messages, model)` | transcript 70% truncation |
| `dEq()` | agent evaluator 가 결과 반환할 verify 도구 |
| `M9({...})` | attachment 메시지 빌더 |
| `Q(...)` | tengu_* 텔레메트리 이벤트 |
| `kH("goal_met" / "goal_set")` | 시스템 사운드 |
| `Ey7` | 0.7 (transcript 예산) |
| `$oH` | 4000 (조건 길이 상한) |
| `i27` | clear 키워드 Set |

추출 명령 예시 (재현용):
```bash
awk 'NR>=8830 && NR<=8860' extract/bundle.js | less -SR
/usr/bin/grep -nF 'goal_status' extract/bundle.js
awk 'NR==4451 { p=index($0,"goal_status"); if(p>0) print substr($0,p-2000,4000) }' extract/bundle.js
```
