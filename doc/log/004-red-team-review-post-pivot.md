# Red Team Review — Post-Pivot (Claude Haiku as Primary)

**Date:** March 26, 2026, 19:50 EST
**Reviewer:** Senior Architect (Red Team)
**Scope:** All planning docs (1-product.md through 6-validation.md) after Qwen2.5 → Claude Haiku pivot
**Context:** M2 Pro, 16GB RAM, 30 hours dev time, Claude Code co-developer

---

## 🚨 Critical Flaws

### 1. Sidecar Description Stale — Still Says "Ollama"

**Where:** `2-decision.md` line 137–138, Sidecar Web Framework section
> "Electron runs on Node.js and cannot call Python directly. The sidecar is a small Python HTTP server that bridges the two — Electron sends requests to it, and it runs Whisper and **Ollama**."

The sidecar no longer "runs Ollama" as primary. It calls the **Anthropic API**. This is a factual inconsistency left over from the pivot.

**Impact:** A reader (or evaluator) skimming this section will think the architecture still uses Ollama as primary.

### 2. Phase 1 Description Stale — Still Says "Whisper and Ollama"

**Where:** `4-build.md` line 59
> "Build the Python HTTP server that runs Whisper and Ollama."

Should say "runs Whisper and calls Claude Haiku API."

### 3. API Key in Sidecar Environment — Security Surface

**Where:** `4-build.md` Step 5 (line 203)
> "Read `ANTHROPIC_API_KEY` from macOS Keychain via `keytar` and set as env var for sidecar process"

The main process reads the key from Keychain, then passes it as an **environment variable** to the sidecar subprocess. This means:
- The API key is visible in `ps auxe` output (process environment)
- Any process on the machine can read `/proc/<pid>/environ` (or macOS equivalent)
- If the sidecar crashes and dumps core, the key is in the dump

**Better approach:** Pass the key via stdin on sidecar startup, or have the sidecar read it from Keychain directly (requires `keytar` in Python — not trivial), or pass via a temporary file with 600 permissions that's deleted immediately.

**Severity:** MEDIUM for a take-home project, but worth noting as a security-conscious design choice.

### 4. IPC Contract Missing New Error Codes

**Where:** `3-plan.md` IPC Contract table (line 207–216)

The error states table in 3-plan.md now lists 8 error types (added API_KEY_MISSING, API_KEY_INVALID, NETWORK_ERROR), but the IPC contract only has a generic `error` channel with `{ code, message }`. This is actually fine — the contract is extensible by code. **No fix needed**, but the Phase 3 acceptance criteria says "All 5 error codes trigger" — should be **8 error codes** now.

**Where:** `3-plan.md` line 346
> "All 5 error codes trigger and display correct messages"

Should say "All 8 error codes."

---

## ⚠️ High-Risk Areas

### 1. `keytar` Native Module Compatibility

`keytar` is a native Node.js module that requires compilation. On recent macOS + Electron versions, native module compatibility can be fragile:
- Requires `node-gyp` and Xcode command-line tools
- May need `electron-rebuild` to match Electron's Node version
- If `keytar` fails to build, the entire onboarding flow breaks (no API key storage)

**Mitigation:** Pre-flight checklist says "verify `npm install keytar` works" — good. But the build doc doesn't mention `electron-rebuild`. Add this to Step 1 scaffold.

### 2. Flask + Anthropic SDK Streaming

The sidecar uses Flask (synchronous) to relay Claude Haiku's streaming response as SSE. The Anthropic Python SDK's `messages.stream()` returns an iterator. Flask can handle this with a generator function + `Response(stream_with_context(...), content_type='text/event-stream')`.

**Risk:** Flask's synchronous nature means the sidecar is **blocked** during the entire polish streaming. If health polling hits `/health` during a polish stream, it will queue behind the stream (Flask handles one request at a time). The health poll will appear to "fail" because it times out waiting for the polish stream to finish.

**Impact:** Health polling during polish could trigger false `SIDECAR_DOWN` errors and auto-restart the sidecar mid-stream.

**Fix options:**
1. **Pause health polling during polish** — simplest; add a flag in main process
2. **Use Flask with threaded=True** — `app.run(threaded=True)` enables concurrent requests
3. **Switch to FastAPI** — more work, but native async

**Recommendation:** Option 2 is one line: `app.run(threaded=True, port=5001)`. Document this explicitly in 4-build.md Step 2.

### 3. Offline Fallback Path Underspecified

The docs mention "offline fallback to Qwen2.5 via Ollama" in several places, but the implementation details are thin:
- Does the sidecar check for Ollama availability on startup?
- Does the user need Ollama installed even if they never use offline mode?
- How does the sidecar know to switch? (reads `vd_offline_mode` from where?)
- The sidecar is a Python process — how does it read localStorage?

**Current gap:** The sidecar reads `ANTHROPIC_API_KEY` from env, but `vd_offline_mode` is in localStorage (renderer-side). The sidecar has no way to know about offline mode unless:
- Main process reads localStorage via IPC and passes `offline_mode` flag to `/polish` request body
- Or sidecar accepts a query param: `POST /polish?offline=true`

This needs to be specified in the IPC contract and `/polish` endpoint spec.

### 4. Double `---` in 3-plan.md

**Where:** `3-plan.md` lines 20–22
Two consecutive `---` separators with nothing between them. Minor formatting issue, but looks sloppy to an evaluator.

---

## 🔍 Hidden Assumptions

### 1. "Claude Haiku handles Korean natively" — Not Validated

The pivot document says Qwen2.5 failed at 35%, but **Claude Haiku has not been tested yet**. The plan assumes it will work perfectly based on reputation, not empirical evidence.

**Risk:** What if Claude Haiku has its own quirks with Korean dictation cleanup? (e.g., over-corrects casual Korean to formal, rewrites sentences instead of cleaning, or handles fillers differently than expected)

**Recommendation:** Run the same 20-utterance test against Claude Haiku before Phase 1. This is cheap (~$0.02) and takes 5 minutes.

### 2. Anthropic API Endpoint Assumption

`4-build.md` references `claude-haiku-4-5-20251001` as the model ID. This is a specific dated snapshot. If this model ID is deprecated or renamed by the time the project is evaluated, the app will break.

**Safer:** Use `claude-haiku-4-5` (latest) or document the exact model version with a fallback strategy.

### 3. Whisper `initial_prompt` for Vocabulary Boost

`4-build.md` Step 2 uses Whisper's `initial_prompt` parameter to bias recognition toward custom vocabulary terms. This is borrowed from the OpenWhispr pattern.

**Assumption:** That `initial_prompt` actually improves recognition of domain terms. In practice, `initial_prompt` biases the language model but can also **hallucinate** those terms when they weren't spoken. If the user adds "MOSFET" to vocabulary but says something unrelated, Whisper might phantom-insert "MOSFET" into the transcript.

**Recommendation:** Note this risk in the build doc and test empirically.

---

## 📋 Gaps & Ambiguities

### 1. Settings Modal Missing from IPC Contract

The settings modal (⌘,) needs to:
- Read/write `vd_vocab` (localStorage — renderer-side, no issue)
- Read/write `ANTHROPIC_API_KEY` (Keychain — requires main process IPC)
- Read/write `vd_offline_mode` (localStorage — renderer-side)

The IPC contract in 3-plan.md has no channels for:
- `save-api-key` (renderer → main)
- `get-api-key` (renderer → main → renderer)
- These are needed for the settings modal to work.

### 2. Vocab Passed to Both Transcribe and Polish — But Different Paths

- `/transcribe` receives vocab in request body → used as Whisper `initial_prompt`
- `/polish` receives vocab in request body → injected into Claude system prompt

But in Step 5 (main.js), vocab is "read from localStorage via IPC." This means:
1. Renderer reads `vd_vocab` from localStorage
2. Sends to main process (how? There's no IPC channel for this)
3. Main process includes in both `/transcribe` and `/polish` requests

**Gap:** No IPC channel defined for passing vocab from renderer to main. Either:
- Main reads vocab itself (but it can't access localStorage)
- Renderer sends vocab with `start-recording` payload (currently payload is empty: `—`)

**Fix:** Add vocab to `start-recording` payload: `{ vocab: ["MOSFET", ...] }`. Update IPC contract.

### 3. Error Code Count Mismatch

- `3-plan.md` Error States table: 8 errors listed
- `4-build.md` Step 10: 8 error codes listed ✓ (matches)
- `3-plan.md` Phase 3 acceptance: "All 5 error codes" — **should be 8**
- Phase 3 only covers P0 (no API key setup), so maybe only 5 are relevant at Phase 3? But API_KEY_MISSING could fire at Phase 3 if the key isn't set.

**Clarify:** Which error codes are Phase 3 vs Phase 4 responsibility.

### 4. Onboarding Blocks on API Key — But What About Offline-Only Users?

Step 9 says: `"I understand, let's go" (disabled until API key is saved)`

But what if the user wants offline-only mode (Qwen2.5)? They can't proceed past onboarding without an API key. There should be a "Skip — use offline mode" option.

---

## 🎯 Verdict

**Status: 🟡 CAUTION**

**Summary:** The pivot is well-reasoned and thoroughly documented. The core architecture is sound. However, the pivot introduced several consistency issues (stale Ollama references) and new gaps (IPC channels for API key management, Flask threading during streaming, offline mode data flow). None are show-stoppers, but fixing them before Phase 1 will prevent mid-implementation confusion.

**Fix before starting Phase 1:**
1. ✅ Clean up stale "Ollama" references in 2-decision.md and 4-build.md
2. ✅ Add `app.run(threaded=True)` to Flask server spec (prevents health poll blocking during polish)
3. ✅ Add IPC channels for API key management (`save-api-key`, `get-api-key`)
4. ✅ Add vocab to `start-recording` IPC payload
5. ✅ Fix Phase 3 acceptance criteria error code count
6. ✅ Add "Skip — use offline mode" to onboarding
7. ✅ Run Claude Haiku against the 20-utterance test set ($0.02, 5 min) — don't assume, validate
8. ✅ Specify how `vd_offline_mode` reaches the sidecar (request body flag)

**Riskiest part to watch:** Flask threading + SSE relay. If health polling interferes with polish streaming, the UX will feel broken. Test this specifically in Phase 3.
