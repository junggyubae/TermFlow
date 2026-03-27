# Project Log

**Red Team Review Summary** — Issues found, validations required, decisions made

**Date:** March 26, 2026, 7:45 PM UTC
**Developer:** Single developer + Claude Code co-developer
**Hardware:** Apple M2 Pro, 16GB RAM
**Time Budget:** 30 hours remaining
**Verdict:** 🟡 CAUTION — PROCEED WITH REQUIRED PROTOTYPES

---

## ⏱️ Time Context

- **Now:** March 26, 2026, 19:45 UTC
- **Budget:** 30 hours of development time
- **Leverage:** Claude Code handles implementation, debugging, testing
- **Effective Speed:** With Claude Code, expect 30–50% faster execution than solo development
- **Realistic Effective Time:** ~40–45 effective hours of development output

---

## 🚨 Critical Flaws (Must address before shipping)

### **1. Qwen2.5 Code-Switching Accuracy — UNVALIDATED CORE ASSUMPTION**

| Issue | Impact | Status |
|-------|--------|--------|
| **Problem** | Entire product relies on Qwen2.5 preserving English terms inside Korean sentences. No real validation. | UNTESTED |
| **Test acceptance** | Plan requires "8/10 utterances work" — too low (80% fail rate unacceptable for users) | NEEDS REVISION |
| **Missing spec** | No definition of "preserve correctly" (exact match? case? spacing?) | UNDEFINED |
| **Test set size** | 10 utterances too small for confidence on technical terms (MOSFET, pathophysiology, Hamiltonian) | INSUFFICIENT |
| **Fallback plan** | If fails, no recovery architecture documented | INCOMPLETE |

**Action:** Validate NOW with 20 diverse utterances (medical, engineering, CS) requiring 95%+ accuracy before Phase 1 coding.

**Timeline:** 1–2 hours

---

### **2. Qwen2.5 vs Claude Haiku Fallback — INCOMPLETE CONTINGENCY**

| Issue | Impact | Status |
|-------|--------|--------|
| **"One-line change" is false** | Requires: API key setup (Keychain), schema changes (track model per transcript), cost disclosure (not free), latency trade-off (network dependent) | DECEPTIVE |
| **Privacy breaks** | Fallback switches from local to cloud (transcripts leave machine) — user unaware | NOT DOCUMENTED |
| **No API key flow** | How to request key? How to store in Keychain? How to handle rejection? | UNSPECIFIED |
| **Cost implications** | ~$0.001 per transcript — must be visible to user before fallback activates | UNDESIGNED |
| **Schema gap** | Cannot compare transcripts from different models (no `model_used` field) | MISSING |

**Action:** Before Phase 1, design complete fallback path (API key flow, cost disclosure, schema changes). Update plan.md.

**Timeline:** 2–3 hours planning

---

### **3. IPC + Process Orchestration — UNTESTED ARCHITECTURE**

| Issue | Impact | Status |
|-------|--------|--------|
| **Simultaneous child processes** | Swift binary + Python sidecar + Electron renderer all communicating. Deadlock risk. | RISKY |
| **No timeouts specified** | What if Swift exits without flushing? What if sidecar hangs? App freezes silently. | UNSPECIFIED |
| **Cleanup on crash** | If either child dies mid-operation, what happens? Orphan processes? Frozen UI? | UNDEFINED |
| **State machine incomplete** | Main process state transitions undefined (can it handle multiple recording attempts? queuing?) | UNDERSPECIFIED |
| **Debugging is manual** | "If hanging, check process with ps" is debugging advice, not architecture | NOT PRODUCTION-READY |

**Action:** Build throwaway PoC (spawn Swift + poll sidecar + relay SSE) before Phase 3. Verify no deadlocks, orphans, or hangs.

**Timeline:** 2–3 hours prototype

---

### **4. SSE Streaming Through IPC — ARCHITECTURAL MISMATCH**

| Issue | Impact | Status |
|-------|--------|--------|
| **Ollama streaming unknown** | Does `/api/chat` stream tokens or buffer entire response? If buffered, "streaming" is fiction. | UNTESTED |
| **IPC event overhead** | 200 tokens = 200 IPC events. Electron IPC not high-throughput. Performance untested. | UNVALIDATED |
| **Token ordering** | If IPC events queue/reorder, tokens arrive scrambled. No ordering guarantees. | UNSPECIFIED |
| **SSE parsing undefined** | How does main process read HTTP response body? Incomplete line buffering issues. | UNDERSPECIFIED |
| **Product benefit at risk** | "Streaming feels fast" only works if tokens actually arrive incrementally | CONTINGENT |

**Action:** Prototype during Phase 1. Test Ollama SSE streaming directly. Measure latency and token arrival rate.

**Timeline:** 2 hours prototype

---

## ⚠️ High-Risk Areas (Validate before committing)

### **5. Swift Audio Binary — Compilation & Permissions**

- **Risk:** Info.plist buried in Electron app bundle. How is NSMicrophoneUsageDescription configured?
- **Risk:** Universal binary (arm64 + x86_64) cross-compile via `swiftc` — works on M2 Pro or requires Xcode?
- **Action:** Run pre-flight checklist Step 4 before Phase 2 starts (30 min)

---

### **6. localStorage Capacity — Silent Data Loss**

- **Risk:** 100-entry cap. Old transcripts silently dropped with no warning.
- **Action:** Add warning UI when approaching capacity + explicit deletion confirmation
- **Timeline:** Phase 4 (1 hour)

---

### **7. Language Detection Edge Cases**

- **Risk:** Whisper confidence threshold (0.85) may misclassify mixed-language speech as monolingual
- **Impact:** History sidebar shows wrong language badge
- **Action:** Test on real mixed-language utterances during Phase 1
- **Severity:** Minor UX issue, not blocking

---

### **8. Model Download Failure Recovery**

- **Risk:** If Whisper download stalls/fails, user sees frozen progress bar
- **Action:** Document retry/resume strategy. Implement error recovery in Phase 4.
- **Timeline:** Phase 4 (2 hours)

---

## 🔍 Ambiguities (Must clarify before building)

### **9. What is "Correct" Polish Output?**

- System prompt outlined but not written
- No example input → output pairs for validation
- Acceptance criteria "8/10 utterances" unverifiable without definition
- **Action:** Write system prompt with 3–5 example utterances before Phase 1

---

### **10. Sidecar Health Polling Logic**

- How many `/health` failures = error state?
- Does main process queue requests while sidecar is down?
- What happens if sidecar crashes mid-transcription?
- **Action:** State diagram for main process before Phase 3

---

### **11. Keyboard Shortcuts**

- ⌘R, ⌘C, ⌘, mentioned but not fully specified
- No conflict detection with other apps
- **Action:** Document full hotkey map + conflict strategy in Phase 4

---

### **12. Privacy Statement Missing**

- Claims "fully local" but fallback to Claude breaks this
- User unaware transcripts could leave the machine
- **Action:** Add privacy disclosure in onboarding modal (Phase 4)

---

## 📋 Required Validations & Prototypes

### **Validation 1: Qwen2.5 Code-Switching (BEFORE Phase 1)**

**Test:** Run 20 diverse utterances through local Qwen2.5

```
Medical: "cardiovascular disease에서 hypertension이 atherosclerosis에 미치는 영향을 pathophysiology 중심으로 설명해줘"
Engineering: "MOSFET이 saturation region에서 동작할 때 threshold voltage는 어떻게 결정되는가"
CS: "GitHub repository에서 merge conflict를 해결하는 방법을 설명해줘"
[Add 17 more diverse examples]
```

**Acceptance:** 95%+ preserve English terms correctly
**If fails:** Switch to Claude Haiku fallback path (2–3h refactoring)
**Timeline:** 1–2 hours

---

### **Validation 2: SSE Streaming (BEFORE Phase 1)**

**Test:** Call Ollama `/api/chat` with `stream=true`

- Measure: Does response return tokens incrementally or buffer entire response?
- Measure: Latency to first token, latency between tokens, total latency
- Verify: Token count matches expected for input
- Verify: No line buffering/incomplete token issues

**Acceptance:** Tokens arrive within 100ms of generation, incrementally (not buffered)
**If fails:** Switch to batch response (removes "streaming feels fast" feature)
**Timeline:** 2 hours

---

### **Validation 3: IPC + Process Orchestration PoC (BEFORE Phase 3)**

**Build:** Throwaway prototype

```
✓ Spawn Swift binary via child_process
✓ Send "stop\n" via stdin
✓ Read WAV path from stdout
✓ Spawn Python sidecar HTTP server
✓ Poll /health every 500ms, emit status to test IPC listener
✓ Call /polish with SSE response
✓ Parse SSE, relay tokens as IPC events to test renderer
✓ Graceful cleanup on exit (kill both children)
✓ Test orphan processes (ps -ef | grep recorder)
```

**Acceptance:** No hangs, no orphans, tokens arrive in order, processes clean up on exit
**Timeline:** 2–3 hours

---

## 🎯 Decisions Made

| Decision | Status | Rationale |
|----------|--------|-----------|
| Validate Qwen2.5 before Phase 1 | ✅ APPROVED | Core feature, high risk. 1-2 hours validation saves weeks of rework. |
| Build IPC PoC before Phase 3 | ✅ APPROVED | Most complex phase. 2-3 hours prototype de-risks entire phase. |
| Prototype SSE streaming in Phase 1 | ✅ APPROVED | Product benefit depends on this. Validate early. |
| Complete Claude Haiku fallback design | ✅ APPROVED | Current "one-line" plan is misleading. Need full contingency. |
| Add privacy disclosure to onboarding | ✅ APPROVED | Current claims are conditional (Qwen2.5) but undisclosed. |

---

## 📅 Build Order with 30-Hour Budget + Claude Code

**Adjusted timelines account for:**
- Claude Code co-development (30–50% faster)
- Parallel work (Claude writes code while you test)
- Reduced manual debugging (Claude handles boilerplate + testing)

### **Option A: Validation-First (Conservative, de-risk everything)**

1. **Today (2–3 hours)**
   - Qwen2.5 validation: test 20 utterances (1h)
   - SSE streaming check: test Ollama `/api/chat` streaming (1h)
   - IPC PoC: spawn Swift + relay SSE (1–2h)
   - **Outcome:** All critical unknowns validated

2. **Phase 1: Sidecar** (4–6 hours with Claude Code)
   - Flask server scaffold (30 min with Claude)
   - Whisper endpoint (1h with Claude)
   - Ollama Polish endpoint + SSE (2h with Claude)
   - System prompt refinement + Qwen2.5 final testing (1h)

3. **Phase 2: Swift Audio** (2–3 hours with Claude Code)
   - Pre-flight: Swift toolchain check (30 min)
   - AVAudioEngine binary (2h with Claude)
   - Universal binary build (30 min)

4. **Phase 3: Electron Core** (6–8 hours with Claude Code)
   - Main process IPC + child spawning (2h with Claude)
   - Sidecar health polling (1h with Claude)
   - SSE relay to renderer (1h with Claude)
   - State machine + error handling (2–3h with Claude)

5. **Phase 4: P1 Features** (4–6 hours with Claude Code)
   - localStorage history (1h with Claude)
   - Vocabulary management (1h with Claude)
   - Onboarding modal + privacy disclosure (1h with Claude)
   - Full error handling (1–2h with Claude)

**Total:** 18–26 hours (Fits in 30-hour budget with buffer)

---

### **Option B: Aggressive (Skip some validation, ship fast)**

Skip PoC validation, start Phase 1 immediately:

1. **Phase 1: Sidecar** (4–6 hours) — Same
2. **Phase 2: Swift Audio** (2–3 hours) — Same
3. **Phase 3: Electron Core** (6–8 hours) — Same
4. **Phase 4: P1 Features** (4–6 hours) — Same

**Risk:** If Qwen2.5 fails mid-Phase 1 or SSE streaming doesn't work, must pivot (2–3h detour).

**Total:** 16–23 hours, but with risk of overrun.

---

## 📊 Realistic Timeline with 30 Hours

| Scenario | Validation | Phase 1–4 | Contingency | Total | Feasible? |
|----------|-----------|----------|------------|-------|-----------|
| **Option A (Conservative)** | 2–3h | 18–23h | 4–5h buffer | 24–31h | ✅ YES (tight) |
| **Option B (Aggressive)** | 0h | 16–23h | 0–2h buffer | 16–25h | ✅ YES (risky) |
| **Full P0+P1** | 0h | 20–28h | 0h | 20–28h | ✅ YES (no buffer) |

**Recommendation:** Option A if you want safety buffer. Option B if confident in Qwen2.5 + SSE.

---

## 🚦 Status & Next Steps

**Current Status:** READY TO START (with caveats)

**Time Remaining:** 30 hours

**With Claude Code:** Expect 40–45 effective hours of output

**Blockers:** None critical (validation clears unknowns, but not mandatory given 30h + Claude Code)

---

## ⚡ DECISION: START VALIDATION or PHASE 1?

**A) START VALIDATION (RECOMMENDED) — 2–3 hours**
- Test Qwen2.5: Run 20 code-switched utterances (1h)
- Test SSE: Ollama `/api/chat` streaming (1h)
- Test IPC: Prototype spawn Swift + relay (1h)
- **Then:** Phase 1–4 with full confidence (24–28h remaining, Claude Code writes most)

**B) START PHASE 1 IMMEDIATELY — Accept some risk**
- Skip validation, start sidecar (Flask + Whisper + Ollama)
- Integrate Qwen2.5 test into Phase 1 acceptance
- If fails mid-Phase 1, must pivot to Claude Haiku (2–3h detour)
- **Then:** Phases 2–4 if Phase 1 succeeds (24–28h remaining)

---

## 📊 Realistic Timeline with 30 Hours + Claude Code

| Scenario | Validation | Phases 1–4 | Buffer | Total | Feasible? |
|----------|-----------|----------|--------|-------|-----------|
| **Option A (Safe)** | 2–3h | 18–23h | 4–5h | 24–31h | ✅ YES |
| **Option B (Fast)** | 0h | 16–23h | 0–2h | 16–25h | ✅ YES |

**Recommendation:** Option A. 2–3h validation eliminates all risk, then ship full P0+P1 with confidence.

---

## 📝 Notes

- Hardware: M2 Pro, 16GB RAM — ✅ No VRAM issues
- Time: 30 hours + Claude Code co-developer — ✅ Feasible
- Leverage: Claude Code handles 70% of implementation — ✅ Advantage
- Risk: Qwen2.5 code-switching is the blocker — Validatable in 1h

**Last Updated:** 2026-03-26, 19:45 UTC
**Red Team Verdict:** 🟡 CAUTION — PROCEED WITH REQUIRED PROTOTYPES
**Effective Status with Claude Code:** 🟢 READY TO SHIP P0+P1 in 30 hours
