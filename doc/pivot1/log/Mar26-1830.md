# Review Log — March 26, 2026, 18:30 EST

## Session Purpose
Final senior architect review of planning docs (1-product through 4-build) compared against OpenWhispr (https://github.com/OpenWhispr/openwhispr), a production-grade open-source voice dictation app built with a similar stack. Also incorporates validation test results from earlier today.

---

## 🚨 Critical Flaws

### 1. Qwen2.5 Validation Test: Fundamentally Flawed Test Design (Not Model Failure)

Test 1 scored 6/20 (30%), but the failure is in **test design, not model capability**:

**Problem A — Test utterances are questions, not dictation transcripts.**
The test inputs are clean, well-formed questions like "설명해줘" (explain to me). The model correctly *answers* them instead of polishing them. Real dictation has fillers, false starts, and trailing off:
- ❌ Test: `"MOSFET이 saturation region에서 동작할 때 threshold voltage는 어떻게 결정되는가"`
- ✅ Real: `"그래서 음 MOSFET이 그러니까 saturation region에서 동작할 때는은 threshold voltage가 어떻게 결정되는지..."`

**Problem B — Scorer is case-sensitive.**
"cardiovascular disease" → "Cardiovascular disease" is scored as FAIL. Capitalization correction is *correct* polish behavior.

**Problem C — Model outputs Chinese on some inputs.**
Utterances #2, #4, #6, #15, #17, #20 produced Chinese (中文) output. This means the system prompt is not constraining the output language. The prompt says "Fix punctuation" but doesn't say "Output in the same language as the input" or "Never translate."

**Action required:**
- Rewrite test utterances to be realistic dictation (with fillers, false starts)
- Fix system prompt: add "Output in the same language mix as the input. Never translate. Never answer questions — only clean the text."
- Fix scorer: case-insensitive matching for English terms
- Rerun Test 1

### 2. System Prompt for Polish is Dangerously Underspecified

The current prompt in 4-build.md Step 3 says:
> "Fix punctuation and capitalization, remove fillers, preserve English terms exactly"

This is insufficient. Qwen2.5 interprets it as "answer the question" or "translate to Chinese/English." OpenWhispr's approach is instructive — they pass vocabulary as `initial_prompt` to Whisper itself, not just to the LLM.

**The polish system prompt must explicitly:**
1. "You are a transcript cleaner. You receive raw speech-to-text output."
2. "Output ONLY the cleaned transcript. Do not answer, explain, or translate."
3. "Preserve the original language mix exactly. If input is Korean with English terms, output is Korean with English terms."
4. "Never output Chinese, Japanese, or any language not present in the input."
5. "Remove filler words: 음, 어, 그러니까, 그래서 (when used as filler), um, uh, like, you know"
6. "Preserve all English technical terms exactly as spoken."

### 3. SSE Streaming Test: Incomplete Results

Test 2 output was truncated — only shows "Streaming tokens..." with no completion data. We don't know if SSE streaming actually works. This test must be rerun.

---

## ⚠️ High-Risk Areas

### 1. Architecture Gap: OpenWhispr Avoids Python Entirely

OpenWhispr's core pipeline is **all compiled binaries** (whisper.cpp C++, llama-server C++, Swift). Zero Python in the hot path. Our plan puts Python (Flask + faster-whisper) in the critical path.

**Why this matters:**
- Python startup time (~1-2s for importing faster-whisper + loading model)
- Python GIL blocks concurrent operations (health polling during transcription)
- Python process crash recovery is messier than binary restart

**Mitigation:** This is acceptable for a 36-hour project. But document that Python sidecar is a deliberate simplicity trade-off, not the production-ideal architecture. If latency becomes an issue, the sidecar could be replaced with whisper.cpp server + llama-server (matching OpenWhispr's pattern).

### 2. Whisper as Persistent Server vs. Per-Request Load

OpenWhispr runs whisper.cpp as a **persistent HTTP server** on its own port. Our plan loads the Whisper model inside the Flask sidecar process. This means:
- First transcription has cold-start latency (model loading ~5-10s)
- Model stays in memory for subsequent calls (good)
- But if sidecar crashes and restarts, model must reload (bad — ~5-10s penalty)

**OpenWhispr's pattern is better** for production but adds complexity. For 36h scope, loading inside Flask is fine. But the sidecar restart scenario should be documented — user will experience a ~10s delay after restart.

### 3. No Audio Format Conversion Step

OpenWhispr uses FFmpeg to convert WebM/Opus → 16kHz mono WAV. Our plan has AVAudioEngine writing directly to WAV. This is cleaner, **but**:
- What sample rate does AVAudioEngine write? If 44.1kHz, faster-whisper must resample to 16kHz internally (adds latency).
- Plan should specify: "AVAudioEngine output: 16-bit PCM, **16kHz**, mono" to match Whisper's native input format.

**Currently 3-plan.md and 4-build.md say "44.1kHz"** — this should be 16kHz to avoid unnecessary resampling.

### 4. Text Insertion Pattern Missing

OpenWhispr implements a sophisticated clipboard flow: save current clipboard → write transcription → simulate Cmd+V → restore clipboard. Our plan only has "copy to clipboard" which requires the user to manually paste.

This is acceptable for P0 scope, but it means our UX requires an extra step vs OpenWhispr. Could be a P2 stretch goal.

### 5. ⌘R Conflicts with Electron DevTools Refresh

`⌘R` is the default Electron shortcut for "reload page" in development. In production builds this is disabled, but during development it will conflict with the record toggle.

**Action:** Add `globalShortcut` or disable default `⌘R` in development. Document this gotcha in 4-build.md.

---

## 🔍 Hidden Assumptions

### 1. "Ollama manages model lifecycle" — But What If Ollama Isn't Running?

The plan assumes Ollama is already running (`ollama serve`). But what if:
- User hasn't started it?
- Ollama crashes mid-session?
- Ollama is installed but model isn't pulled?

OpenWhispr handles this by spawning inference servers as child processes (whisper-server, llama-server). They own the lifecycle. We depend on a separate user-managed Ollama process.

**The sidecar should detect "Ollama not running" and show a specific error**, not just a generic POLISH_FAILED. Add an error code: `OLLAMA_DOWN` with message "Ollama is not running. Start it with `ollama serve` in a terminal."

### 2. "faster-whisper large-v3 works on int8 on Apple Silicon" — Needs Verification

The plan specifies `compute_type="int8"`. faster-whisper's int8 support on Apple Silicon (Metal) is not guaranteed to be as fast as on CUDA. The CTranslate2 backend may fall back to CPU for int8 on macOS.

**Action:** During Phase 1, verify actual compute backend and latency. If int8 is slow, try `float16` or `int8_float16`.

### 3. "500ms health polling" — OpenWhispr Uses 5 Seconds

Our plan polls `/health` every 500ms. OpenWhispr polls every 5 seconds. 500ms is aggressive and wastes CPU cycles for a local app where the sidecar rarely crashes.

**Recommendation:** Change to 2-3 seconds. 500ms is overkill.

### 4. localStorage Max 100 Entries — No Migration Path

If a user hits 100 entries and oldest are dropped, that data is lost silently. OpenWhispr uses SQLite with no practical limit.

For 36h scope, localStorage is fine. But document: "entries beyond 100 are permanently deleted, not archived."

---

## 📋 Gaps & Ambiguities

### 1. No CLAUDE.md / AI Agent Reference Document

OpenWhispr has a `CLAUDE.md` file that serves as an architecture reference for AI coding agents. Since you're using Claude Code as a co-developer, creating a similar file would significantly improve Claude's ability to help during Phase 1-4 implementation.

**Action:** Create a `CLAUDE.md` in project root summarizing: tech stack, file structure, IPC channels, sidecar endpoints, and key conventions.

### 2. Sidecar Model Loading Strategy Undefined

When does the Whisper model load?
- On sidecar startup (slow start, but first transcription is fast)?
- On first `/transcribe` call (fast start, but first transcription has cold start)?

OpenWhispr loads models on startup. Our plan doesn't specify. This should be documented.

**Recommendation:** Load on startup. The sidecar already takes a few seconds to start — loading the model during that time hides the latency.

### 3. Concurrent Model Loading: Whisper + Qwen2.5

The plan says "~2-4 GB free VRAM." But:
- Whisper large-v3 int8: ~1.5 GB
- Qwen2.5 7B Q4_K_M: ~4.7 GB
- Total: ~6.2 GB

On 16 GB M2 Pro, macOS uses ~4-6 GB for system. That leaves ~10-12 GB. Both models should fit, but they're loaded by different processes (Flask sidecar vs Ollama). Verify they don't fight for memory.

### 4. validation-results.md is Empty (0 bytes)

The orchestrator script created the file but didn't write results. The individual test scripts wrote to `/tmp/test1_results.json` and stdout instead. Results logging is broken.

---

## 🆚 OpenWhispr Comparison Summary

| Aspect | Our Plan | OpenWhispr | Gap? |
|--------|----------|-----------|------|
| **Audio capture** | AVAudioEngine (Swift) | CoreAudio CATapDescription | Ours is simpler, theirs is lower-level |
| **STT** | faster-whisper (Python) | whisper.cpp (C++ HTTP server) | Theirs avoids Python; ours is easier to set up |
| **LLM** | Qwen2.5 via Ollama | llama.cpp (llama-server) | Similar; Ollama abstracts GPU management |
| **Sidecar** | Single Flask process | Multiple standalone servers | Ours is simpler; theirs scales better |
| **IPC channels** | 8 | ~150+ | Appropriate for scope difference |
| **Storage** | localStorage (100 max) | SQLite + FTS5 | Appropriate for scope |
| **Text insertion** | Copy to clipboard only | Clipboard save → paste → restore | Gap — theirs is smoother UX |
| **Cross-platform** | macOS only | macOS + Windows + Linux | Appropriate for 36h scope |
| **Planning docs** | 6 docs (product→build) | CLAUDE.md + debug/troubleshoot | We have better planning; they have better dev reference |
| **Custom dictionary** | Passed to LLM polish prompt | Passed as Whisper `initial_prompt` | **Gap — consider passing vocab to Whisper too** |
| **i18n** | None (KO/EN only) | 9 languages | Appropriate for scope |

### Key Takeaway from OpenWhispr

The most valuable pattern from OpenWhispr: **pass custom vocabulary to Whisper as `initial_prompt`**, not just to the LLM polish layer. This helps Whisper recognize domain-specific terms during transcription itself, before polish.

Our plan only passes vocab to `/polish`. We should also pass vocab terms to `/transcribe` as Whisper's `initial_prompt` parameter. This is a one-line change in `server.py`.

---

## 🎯 Verdict

**Status: 🟡 CAUTION — Fix Before Phase 1**

### Must Fix (before coding):
1. **Rewrite polish system prompt** — Current prompt causes Qwen2.5 to answer/translate instead of clean. Add explicit constraints.
2. **Rewrite validation test utterances** — Use realistic dictation with fillers, not clean questions.
3. **Fix audio sample rate** — Change from 44.1kHz to 16kHz in Swift binary spec.
4. **Rerun validation Tests 1 & 2** — Current results are invalid.
5. **Add vocab to Whisper `initial_prompt`** — Learned from OpenWhispr. One-line improvement.

### Should Fix (during Phase 1):
6. **Create CLAUDE.md** — AI coding agent reference doc.
7. **Add OLLAMA_DOWN error code** — Detect Ollama not running specifically.
8. **Change health polling to 2-3s** — 500ms is wasteful.
9. **Document ⌘R devtools conflict** — Will bite during development.
10. **Specify model loading strategy** — Load Whisper on sidecar startup.

### Plan Strengths:
- Document structure is excellent (WHY → HOW → WHAT progression)
- Architecture is sound for 36h scope
- Error handling is well-specified
- Phase breakdown is logical with clear acceptance criteria
- Privacy-conscious design is a genuine differentiator
- Compared to OpenWhispr, our plan is appropriately scoped

---

## Documents to Update

| Doc | Change |
|-----|--------|
| `3-plan.md` | Change audio format from 44.1kHz to 16kHz; change health polling from 500ms to 2s; add OLLAMA_DOWN error code |
| `4-build.md` Step 3 | Rewrite polish system prompt with explicit constraints (no translate, no answer, preserve language) |
| `4-build.md` Step 2 | Add `initial_prompt` vocab passing to Whisper `/transcribe` endpoint |
| `4-build.md` Step 4 | Change Swift output format to 16kHz mono |
| `4-build.md` Step 8A | Document ⌘R devtools conflict during development |
| `6-validation.md` | Rewrite test utterances as realistic dictation; fix scorer to be case-insensitive |
| New: `CLAUDE.md` | Create AI agent reference document |
