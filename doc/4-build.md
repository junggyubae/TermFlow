# Build

**This document defines the WHAT: step-by-step implementation of each phase.**

Step-by-step implementation grouped by the phases in `3-plan.md`. Each phase is tested before moving to the next. Phases 1–3 deliver a complete end-to-end demo (P0 features). Phases 4–5 add remaining features and stretch goals.

---

## Pre-Flight Checklist

**Before starting Phase 1, complete these setup steps:**

- [ ] Read all of `doc/1-product.md`, `doc/2-decision.md`, `doc/3-plan.md` (prerequisites + acceptance criteria)
- [ ] Verify Ollama installed: `which ollama` and `ollama serve` runs without error
- [ ] Download Qwen2.5: `ollama pull qwen2.5:7b` (takes 5–10 min on first run)
- [ ] Download Whisper: `pip install faster-whisper` then test: `echo "test audio" > /tmp/test.wav` and verify Whisper loads without OOM
- [ ] Check VRAM: Open Activity Monitor, verify >4 GB available
- [ ] Verify Swift toolchain: `swift --version` returns ≥5.5
- [ ] Create git repo: `git init` in project root, first commit of this doc set
- [ ] Test cURL: `curl --version` (used for testing endpoints)

**If any step fails:** Stop and fix before proceeding. The entire project depends on these dependencies working.

---

## Testing Strategy

**Phase 1: Sidecar**
- Build endpoints incrementally: `/health` first, then `/transcribe`, then `/polish`
- Test each endpoint with `curl` before moving to the next
- **Qwen2.5 code-switching validation:** After `/polish` works, test on 10 real utterances. If >2 failures, document and proceed; plan fallback to Claude Haiku
- **Accept Phase 1 when:** All three endpoints work, and Qwen2.5 test results are logged

**Phase 2: Swift Binary**
- Test `swiftc` and AVAudioEngine separately from Electron
- Compile and test audio capture in isolation
- Build universal binary and verify on current architecture
- **Accept Phase 2 when:** `./recorder` captures audio cleanly, universal binary created, `.wav` plays back correctly

**Phase 3: Electron Core**
- **High risk zone.** IPC, process spawning, and state management are complex
- Start with main process spawning sidecar health check
- Add recorder spawning and file handling
- Wire IPC messages and HTTP relaying
- **Debugging strategy:** Log every IPC emit and HTTP call; if hanging, check process with `ps` and kill orphans with `pkill recorder`
- **Accept Phase 3 when:** Full loop works end-to-end (speak → transcribe → polish visible in textarea) with no hangs

**Phase 4: P1 Features**
- Lower risk; mostly localStorage and UI refinements
- Streaming output and history
- Vocabulary and onboarding
- Error handling
- **Accept Phase 4 when:** All P1 features work and error messages have recovery paths

---

# Phase 1 — Sidecar

Build the Python HTTP server that runs Whisper and Ollama. This phase is complete when you can call `/health`, `/transcribe`, and `/polish` endpoints locally.

## Step 1 — Project Scaffold

```
mkdir -p electron-app/renderer sidecar swift-audio doc
cd electron-app && npm init -y
npm install electron electron-builder
touch main.js preload.js renderer/index.html renderer/app.js renderer/style.css
cd ../sidecar && python3 -m venv venv && source venv/bin/activate
touch server.py requirements.txt
```

`requirements.txt`:
```
faster-whisper
flask
```

---

## Step 2 — Sidecar: Transcription

**File:** `sidecar/server.py`

- Flask server on `localhost:5001`
- Load `WhisperModel("large-v3", device="cpu", compute_type="int8")` **at startup** (not on first request) — hides model loading latency behind sidecar boot time. If model not yet downloaded, first startup will be slow (~1-2 min) but subsequent starts are fast (~5s).
- `GET /health` → `{ "status": "ok" }`
- `POST /transcribe`
  - Body: `{ "path": "/tmp/vd_recording.wav", "vocab": ["MOSFET", "impedance"] }`
  - Whisper params: `language=None`, `vad_filter=True`, `beam_size=5`
  - **Vocabulary boost:** If `vocab` is provided, join terms into a comma-separated string and pass as Whisper's `initial_prompt` parameter. This biases Whisper toward recognizing domain-specific terms during transcription itself (learned from OpenWhispr pattern).
    ```python
    initial_prompt = ", ".join(vocab) if vocab else None
    segments, info = model.transcribe(path, initial_prompt=initial_prompt, ...)
    ```
  - Language labeled `"mixed"` if `info.language_probability < 0.85`
  - Returns: `{ "raw": "...", "language": "ko", "confidence": 0.97 }`
  - On first call (model not cached): print download progress to stdout as `PROGRESS:n` lines

**Test:** `curl -X POST localhost:5001/transcribe -d '{"path":"test.wav"}'`

---

## Step 3 — Sidecar: Polish

**File:** `sidecar/server.py` (add endpoint)

- `POST /polish`
  - Body: `{ "text": "...", "vocab": ["Hamiltonian", "MOSFET"] }`
  - Returns: SSE stream (`text/event-stream`)
- System prompt (exact text — copy verbatim into `server.py`):
  ```
  You are a transcript cleaner. You receive raw speech-to-text output and clean it up.

  Rules:
  - Output ONLY the cleaned transcript. Do not answer questions, explain, summarize, or add commentary.
  - NEVER translate. Output in the SAME language mix as the input. If input is Korean with English terms, output must be Korean with English terms.
  - NEVER output Chinese, Japanese, or any language not present in the input.
  - Remove filler words: 음, 어, 그러니까 (when used as filler), 그래서 (when used as filler), um, uh, like, you know
  - Fix punctuation and capitalization
  - Correct Korean spacing (띄어쓰기)
  - Insert paragraph breaks on natural topic shifts in longer dictations
  - Preserve all English technical terms exactly as spoken — never translate them to Korean
  - Preserve vocabulary terms exactly as written: {vocab_terms}
  - The output should read like something the user would have typed themselves
  ```
  **Why this is explicit:** Qwen2.5 will answer questions or translate to Chinese if not constrained. Every rule above addresses a real failure mode observed in testing.

**Examples: What "Correct" Polish Output Looks Like**

These are realistic dictation transcripts (with fillers, false starts, trailing off) — not clean questions.

| Raw Whisper (realistic dictation) | Polished Output | Notes |
|---|---|---|
| "그래서 음 MOSFET이 그러니까 saturation region에서 동작할 때는은 threshold voltage가 어떻게 결정되는지..." | "MOSFET이 saturation region에서 동작할 때 threshold voltage가 어떻게 결정되는지," | Fillers removed (그래서, 음, 그러니까). English terms preserved. Not answered — just cleaned. |
| "어 그니까 cardiovascular disease에서 hypertension이 atherosclerosis progression에 영향을 많이 주는데 음 pathophysiology 관점에서 보면은..." | "Cardiovascular disease에서 hypertension이 atherosclerosis progression에 영향을 많이 주는데, pathophysiology 관점에서 보면" | Medical terms preserved exactly. Fillers (어, 그니까, 음) removed. Still Korean output — not translated. |
| "아 GitHub에서 어 merge conflict 나면은 그거를 어떻게 해결하냐면 rebase를 하거나 아니면 그냥 merge를 하거나..." | "GitHub에서 merge conflict가 나면 rebase를 하거나 merge를 하거나," | CS terms preserved. False start (아) removed. Output stays Korean — not translated to English. |
| "um so the impedance matching in RF circuit is like 어 really important because um S-parameter가 그러니까..." | "The impedance matching in RF circuit is really important because S-parameter가" | Mixed EN→KO preserved. English fillers (um, so, like) and Korean fillers (어, 그러니까) both removed. |
| "이번 학기에 음 machine learning 수업에서 overfitting 문제를 어 regularization으로 해결하는 거 배웠는데 그게 뭐냐면은..." | "이번 학기에 machine learning 수업에서 overfitting 문제를 regularization으로 해결하는 것을 배웠는데," | Natural dictation cleaned. Technical terms preserved. Trailing off cleaned up. |

**Acceptance Criteria:**
- ✓ 10+ utterances tested (medical, engineering, CS, general)
- ✓ English terms preserved (case-insensitive match — capitalization fixes are OK)
- ✓ Fillers removed (음, 어, 그러니까, 그니까, um, uh, like, you know)
- ✓ Korean spacing corrected
- ✓ Output reads naturally
- ✓ Output is NEVER translated — same language mix as input
- ✓ Output is NEVER an answer to a question — just cleaned text

- Model: Qwen2.5 7B via Ollama (`localhost:11434`)
- Call Ollama's OpenAI-compatible endpoint: `POST /api/chat`, `stream=True`
- Each streamed token emitted as `data: {"token": "..."}\n\n`
- Final `data: [DONE]\n\n`
- **Fallback note:** if switching to Claude Haiku, replace the Ollama call with `anthropic.messages.stream(model="claude-haiku-4-5", ...)` — system prompt and SSE interface stay the same

**Prerequisites:** `ollama pull qwen2.5:7b` (run once, ~4GB download)

**Test:** `curl -N -X POST localhost:5001/polish -d '{"text":"그래서 음 MOSFET이 그러니까 saturation region에서 동작할 때는은..."}'`

---

# Phase 2 — Audio Binary

Build the Swift CLI that captures mic input and writes `.wav` files. This phase is complete when you can run `./recorder`, speak, type `stop`, and get a `.wav` file.

## Step 4 — Swift Audio Binary

**File:** `swift-audio/main.swift`

- `AVAudioEngine` captures mic input
- Writes to `/tmp/vd_recording.wav` (16-bit PCM, **16kHz**, mono) — 16kHz matches Whisper's native input format, avoiding unnecessary resampling latency
- Reads stdin in a loop:
  - On `stop\n`: stop engine, flush file, print file path to stdout, exit 0
- Request mic permission via `AVCaptureDevice.requestAccess`
- Compile:
  ```bash
  swiftc main.swift -o recorder
  # universal binary:
  swiftc main.swift -target arm64-apple-macos12 -o recorder_arm64
  swiftc main.swift -target x86_64-apple-macos12 -o recorder_x86
  lipo -create recorder_arm64 recorder_x86 -output recorder
  ```

**Test:** `./recorder` → speak → type `stop` → check `/tmp/vd_recording.wav`

---

# Phase 3 — Electron Core (P0)

Wire Electron's main process and renderer together. The sidecar and Swift binary are now controlled by the app's UI. This phase is complete when you can record, transcribe, and see polished output streaming into the textarea.

> **Milestone: End-to-end demo after Phase 3 — covers all P0 features**

## Step 5 — Electron Main Process

**File:** `electron-app/main.js`

**On `app.ready`:**
- Spawn sidecar: `python sidecar/server.py`
- Poll `GET /health` every 2s; emit `sidecar-status: ready` to renderer when up (500ms was too aggressive — 2s is sufficient for a local single-user app)
- Parse stdout lines matching `PROGRESS:n` → emit `model-download-progress: { percent: n }`

**On `start-recording` IPC:**
- Spawn Swift binary: `./recorder`
- Store process reference

**On `stop-recording` IPC:**
- Write `stop\n` to Swift process stdin
- Read stdout for file path
- `POST /transcribe { path }` → emit `transcription-raw: { text, language }`
- `POST /polish { text, vocab }` (vocab read from localStorage via IPC)
  - Stream SSE response → emit `polish-token: { token }` per token
  - On `[DONE]` → emit `polish-done: { full }`

**On `app.quit`:** Kill sidecar and recorder processes.

**On any error:** Emit `error: { code, message }` with a specific code string (e.g., `MIC_DENIED`, `SIDECAR_DOWN`, `TRANSCRIBE_FAILED`, `POLISH_FAILED`).

---

## Step 6 — Renderer: Core UI

**Files:** `renderer/index.html`, `renderer/app.js`, `renderer/style.css`

**State machine:** `idle → recording → processing → streaming → idle`

**Elements:**
- Record/stop toggle button — `⌘R` keyboard shortcut
- State indicator: pulsing red dot + elapsed timer (during `recording`)
- Spinner + "Transcribing…" label (during `processing`)
- Language badge: `EN` / `KO` / `MIXED` (shown after transcription)
- `<textarea>` for polished output — editable so user can fix errors inline
- Collapsible `<details>` block below showing raw transcript
- Copy button — `⌘C` — copies polished text to clipboard

**IPC listeners:**
- `transcription-raw` → update language badge, show raw in collapsed block
- `polish-token` → append token to textarea
- `polish-done` → re-enable record button, save to history
- `error` → show inline error banner with recovery message per error code

> **✓ End-to-end demo working at this point**

---

# Phase 4 — P1 Features

Add the remaining strongly-preferred features: history, vocabulary, onboarding, and comprehensive error handling.

## Step 7 — Transcript History

**Storage:** `localStorage` key `vd_history`, schema in `plan.md`.

**On `polish-done`:**
- Build entry object: `{ id, timestamp, language, duration, raw, polished }`
- Prepend to `vd_history` array; trim to 100 entries; save

**History sidebar (right panel):**
- Renders list of entries sorted newest-first
- Each row: relative timestamp, language badge, first line of polished text (truncated), copy button
- Click row → load `polished` into main textarea, `raw` into collapsed block
- "Clear history" button at bottom

---

## Step 8 — Custom Vocabulary

**Storage:** `localStorage` key `vd_vocab` → `{ terms: string[] }`.

**Settings panel (`⌘,`):**
- Modal or side drawer
- Textarea: one term per line
- On save: parse lines → store → render as removable tag chips below textarea
- "Clear all" button
- Active count displayed in main UI: subtle `"3 terms"` badge near record button

**In `POST /polish` request:**
- Read `vd_vocab.terms` from localStorage
- Pass as `vocab` in request body
- Sidecar injects into system prompt before calling the model

---

## Step 8A — Keyboard Shortcuts

**Hotkey specification:**

| Hotkey | Action | Context | Conflict Handling |
|--------|--------|---------|------------------|
| **⌘R** | Toggle Recording | Global (from renderer) | If app not focused, implement global hotkey in Phase 5 (stretch) |
| **⌘C** | Copy polished text to clipboard | Recording finished, idle state | Standard Electron behavior (doesn't conflict with system) |
| **⌘,** (Cmd+Comma) | Open Settings / Vocabulary | Any state | Standard macOS convention for settings |

**Implementation details:**
- **⌘R**: Bind in `renderer/app.js` via `window.addEventListener('keydown', ...)` — only active when app window focused. **⚠️ Dev conflict:** ⌘R is Electron's default "reload page" shortcut in development. Disable it in dev mode: `globalShortcut.unregister('CommandOrControl+R')` or set `Menu.setApplicationMenu(null)` to remove default menu.
- **⌘C**: Implement copy-to-clipboard using Electron's `clipboard.writeText(polishedText)` when textarea is not in focus
- **⌘,**: Open vocabulary settings modal (Step 8)
- **No global hotkey in Phase 3** — record/stop requires window focus. Global hotkey (push-to-talk) is Phase 5 stretch goal
- **Conflict detection**: These hotkeys are standard macOS patterns and shouldn't conflict with system defaults. User remapping is Phase 5.

**Keyboard handling flow:**
```
User presses key
  ↓
[App focused?]
  ├─ No → hotkey ignored (focus on other app)
  └─ Yes
     ├─ ⌘R → emit start-recording or stop-recording IPC
     ├─ ⌘C → copy textarea content to clipboard
     └─ ⌘, → open settings modal
```

---

## Step 9 — Onboarding & Model Download

**First launch** (`vd_onboarded` not set in localStorage):
- Show setup modal before main UI
- Instructions (two parts):
  1. **Tech setup**: "Whisper model (1.5 GB) will download on first transcription. Ollama must be running (`ollama serve`)."
  2. **Privacy disclosure**: "This app is fully local — all audio and transcripts stay on your machine. If the transcript quality is poor, you can optionally enable Claude Haiku (cloud-based) as a fallback polish layer. This will require an Anthropic API key and will send transcripts to Anthropic's servers for processing. You control this via Settings."
- Button: "I understand, let's go"
- On click: `vd_onboarded = true` → dismiss modal → show main UI

> **Note:** No API key is required for primary use. The entire pipeline runs locally (Whisper + Qwen2.5 via Ollama). Privacy disclosure explains that fallback to Claude Haiku would shift transcripts to cloud.

**First transcription** (model not downloaded yet):
- Main process spawns sidecar: `python sidecar/server.py`
- Sidecar prints `PROGRESS:n` to stdout during Whisper model download
- Main process parses and emits `model-download-progress: { percent }`
- Renderer shows inline progress bar: "Downloading Whisper model (1.5 GB)… n%"

---

## Step 10 — Error Handling

Implement recovery for every `error` code emitted by main process. See the error states table in `3-plan.md` for the full list.

| Code | UI action |
|---|---|
| `MIC_DENIED` | Banner: "Microphone access denied" + button → `shell.openExternal('x-apple.systempreferences:...')` |
| `SIDECAR_DOWN` | Auto-restart sidecar once; if second failure → "Restart app if this persists" |
| `OLLAMA_DOWN` | Banner: "Ollama is not running. Start it with `ollama serve` in a terminal." — Detect by checking if Ollama port (11434) is reachable before calling `/polish`. Distinct from POLISH_FAILED. |
| `EMPTY_AUDIO` | Toast: "Nothing was captured — try again" |
| `TRANSCRIBE_FAILED` | Toast: "Transcription failed — try again" |
| `POLISH_FAILED` | Show raw transcript + notice: "Polish unavailable" |

All error banners dismissible. Return to `idle` state after any error.

---

# Phase 5 — Stretch Goals

For stretch goals (global hotkey, push-to-talk, tone settings, export, packaging), see `5-stretch.md`.

