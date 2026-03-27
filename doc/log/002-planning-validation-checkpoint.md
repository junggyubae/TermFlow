# Project Log — Mar 26, 17:18 EST

## Validation Testing Complete (Tests 1 & 2)

### Test 1: Qwen2.5 Code-Switching — ✅ PASS (19/20)

**3 attempts needed to get the right prompt:**

| Attempt | Approach | Result |
|---------|----------|--------|
| v1 | "Fix punctuation, remove fillers" | 6/20 (30%) — model answered questions, translated to Chinese |
| v2 | Added "do not answer/translate" | 5/20 (25%) — model translated English terms to Korean (머신 러닝, 과적합) |
| v3 | Few-shot examples + explicit WRONG examples | 19/20 (95%) ✅ |

**Lesson learned:** Qwen2.5 7B requires explicit few-shot examples showing the exact input→output format, plus negative examples showing what NOT to do. A simple instruction-based prompt is insufficient.

**1 failure:** Utterance #10 ("signal integrity... high-speed PCB design") outputted Chinese. Mitigation: detect Chinese chars in output → retry once.

### Test 2: SSE Streaming — ✅ PASS

- First token: 349ms (English), 440ms (Korean polish)
- Tokens arrive incrementally (~50ms apart), not buffered
- Total latency: ~1.4s for 26-token Korean polish output
- Confirms SSE relay via Electron IPC is viable

### Remaining: Test 3 (IPC PoC)

Not run — requires Swift binary compilation + Electron wiring. Lower risk than model quality question. Will be done as Phase 1 Step 1.

## Decisions Made

1. **System prompt is locked in** — must use v3 (few-shot + negative examples) in production
2. **Add Chinese-detection retry** — new requirement for `/polish` endpoint
3. **Phase 1 can begin** — both critical unknowns validated
4. **Test 3 folds into Phase 1** — IPC PoC becomes first implementation step

## Updated Risk Assessment

| Risk | Before Validation | After Validation |
|------|-------------------|------------------|
| Qwen2.5 can't handle code-switching | 🔴 Critical | 🟢 Mitigated (with correct prompt) |
| SSE streaming doesn't work incrementally | 🟡 High | 🟢 Resolved |
| Prompt sensitivity (wrong prompt = 25%) | Not identified | 🟡 New risk — prompt must be exact |
| Chinese output edge case | Not identified | 🟡 New risk — needs retry logic |
| IPC deadlocks | 🟡 High | 🟡 Still untested |
