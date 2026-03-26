# Plan

**This document defines the HOW: the technical architecture, data models, interfaces, and development sequence.**

This document translates the decisions in `2-decision.md` into a concrete architecture. It covers the target metrics, the chosen stack, how the pieces connect, what data looks like at rest, and the development sequence.

---

## Prerequisites (Before Starting to Code)

Before Phase 1, verify the tech stack works:

1. **Ollama + Qwen2.5 load** — Run `ollama pull qwen2.5:7b` and `ollama serve`. Verify model loads without errors.
2. **Whisper quality** — Install `pip install faster-whisper`, transcribe a test utterance (Korean + English), verify accuracy on code-switching.
3. **VRAM availability** — Check Activity Monitor: confirm >4 GB available when both models are loaded.
4. **Swift compilation** — Test compile `swift --version` and attempt a simple HelloWorld.swift to verify toolchain works.

**Time allocation:** 1–2 hours. **Outcome:** Confidence that all dependencies are accessible. If any step fails, address before proceeding.

---

---

## Performance Targets

What "working well" means, before writing a line of code.

| Metric | Target |
|---|---|
| Time to first polished token | < 500ms after transcription completes |
| Transcription latency (short utterance) | 1–2 seconds after speech ends |
| English terms in Korean sentences | Preserved correctly by polish layer |
| Korean spacing | Corrected by polish layer |

---

## Stack

One line per layer — the full rationale for each choice is in `2-decision.md`.

| Layer | Choice |
|---|---|
| UI | Electron |
| Audio Capture | AVAudioEngine (Swift native binary) |
| Transcription | faster-whisper large-v3 (local Python sidecar) |
| LLM Polish | Qwen2.5 7B via Ollama (local), streamed |

---

## Repository Structure

```
/
├── electron-app/
│   ├── main.js                  ← main process: IPC, child process management, HTTP relay
│   ├── preload.js               ← contextBridge: safe IPC surface for renderer
│   ├── package.json
│   └── renderer/
│       ├── index.html
│       ├── app.js               ← UI state machine, IPC listeners, DOM updates
│       └── style.css
├── sidecar/
│   ├── server.py                ← Flask: /health, /transcribe, /polish
│   ├── requirements.txt
│   └── venv/
├── swift-audio/
│   ├── main.swift               ← AVAudioEngine CLI
│   └── recorder                 ← compiled universal binary (arm64 + x86_64)
├── doc/
│   ├── 0-instructions.md
│   ├── 1-product.md
│   ├── 2-decision.md
│   ├── 3-plan.md
│   ├── 4-build.md
│   └── 5-stretch.md
└── README.md
```

---

## Architecture

How the four components talk to each other at runtime.

### System Overview

```
[Electron Renderer] <--IPC--> [Electron Main Process]
  (UI, state machine)              (IPC hub, spawner)
                                   /              \
                    spawn+stdin/stdout       HTTP (localhost:5001)
                               /                    \
                              /                      \
                    [Swift Audio Binary]      [Python Sidecar]
                    (AVAudioEngine)           (Flask server)
                    /tmp/vd_recording.wav     /health
                                             /transcribe (faster-whisper)
                                             /polish (Ollama/Qwen2.5 → SSE)
```

### Recording Flow

```
User speaks
   |
   v
[Renderer] start-recording IPC
   |
   v
[Main] spawn Swift binary
   |
   v
[Swift] AVAudioEngine captures mic → /tmp/vd_recording.wav
   |
   v
User stops speaking (stdin: "stop\n")
   |
   v
[Swift] Flush & exit, print file path to stdout
   |
   v
[Main] POST /transcribe with .wav path
   |
   v
[Sidecar] faster-whisper processes audio
           Language detection (confidence check)
   |
   v
[Main] emit transcription-raw to renderer
   |
   v
[Renderer] Display raw text + language badge
```

### Polish Flow

```
Raw transcript ready
   |
   v
[Main] POST /polish with { text, vocab }
   |
   v
[Sidecar] Qwen2.5 7B via Ollama
          Stream response as SSE tokens
   |
   v
[Main] Relay SSE stream as polish-token IPC
   |
   v
[Renderer] Append each token to textarea (streaming)
   |
   v
[Sidecar] Send final [DONE]
   |
   v
[Main] emit polish-done IPC
   |
   v
[Renderer] Save full transcript to localStorage history
```

The main process is the hub. It spawns both the Swift binary and the Python sidecar, relays audio file paths and text between them, and forwards results to the renderer over IPC.

### Sidecar Health Polling State Machine

```
[App Launch]
    ↓
[Main: Spawn sidecar, start health polling]
    ↓
[Poll /health every 2s]
    ├─ Success (200 OK) → emit sidecar-status: "ready" → Ready to accept /start-recording
    ├─ Failure → Retry up to 3 times (1.5s total)
    │   ├─ All fail → emit sidecar-status: "error"
    │   └─ User sees: "Sidecar unavailable. Attempting restart..."
    │       ↓
    │       [Auto-restart sidecar once]
    │       ├─ Restart succeeds → Back to polling
    │       └─ Restart fails → emit sidecar-status: "fatal"
    │           → User sees: "Restart failed. Please restart the app."
    │
    └─ During transcription (/transcribe call):
        ├─ Completes normally → emit transcription-raw
        └─ Sidecar crashes → Auto-restart sidecar
            ├─ Restart succeeds → Retry /transcribe (or emit error if already retried)
            └─ Restart fails → emit error: SIDECAR_DOWN

During streaming (/polish call with SSE):
  ├─ Stream completes normally → emit polish-done
  └─ Stream interrupted → Emit POLISH_FAILED (don't retry; user can re-trigger)
```

**Specific Rules:**
- Health polling runs continuously every 2s (even during recording/transcription)
- If `/health` fails 3x in a row → attempt auto-restart (once per session)
- If auto-restart succeeds → resume polling
- If auto-restart fails → show fatal error, disable recording until app restart
- During mid-operation crash → emit specific error code (SIDECAR_DOWN, TRANSCRIBE_FAILED, POLISH_FAILED)

---

## IPC Contract

All communication between the renderer and the main process goes through named channels. This surface is defined once and never changes shape.

| Channel | Direction | Payload |
|---|---|---|
| `start-recording` | renderer → main | — |
| `stop-recording` | renderer → main | — |
| `transcription-raw` | main → renderer | `{ text, language }` |
| `polish-token` | main → renderer | `{ token }` |
| `polish-done` | main → renderer | `{ full }` |
| `error` | main → renderer | `{ code, message }` |
| `sidecar-status` | main → renderer | `{ status: "starting" \| "ready" \| "error" }` |
| `model-download-progress` | main → renderer | `{ percent }` |

---

## Data Schema

What gets persisted to `localStorage` and what each field means.

### Transcript entry (`localStorage` key: `vd_history`)

```json
[
  {
    "id": "uuid-v4",
    "timestamp": 1711234567890,
    "language": "ko",
    "duration": 14,
    "raw": "그래서 음 MOSFET이 그러니까 saturation region에서 동작할 때는은...",
    "polished": "MOSFET이 saturation region에서 동작할 때는,"
  }
]
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | `crypto.randomUUID()` |
| `timestamp` | number | `Date.now()` at record-stop |
| `language` | `"en"` \| `"ko"` \| `"mixed"` | from Whisper `info.language`; set to `"mixed"` if confidence < 0.85 |
| `duration` | number | seconds of audio captured |
| `raw` | string | Whisper output before polish |
| `polished` | string | Final polished output from Qwen2.5 |

Max 100 entries; oldest dropped on overflow. Total localStorage budget: ~2 MB.

### Vocabulary (`localStorage` key: `vd_vocab`)

```json
{ "terms": ["MOSFET", "impedance", "myocardial infarction", "tachycardia"] }
```

Plain string array. Max 100 terms. No per-term metadata.

### Settings

| Setting | Storage | Notes |
|---|---|---|
| `vd_vocab` | localStorage | Vocab terms array |
| `vd_onboarded` | localStorage | Boolean — hides setup modal after first run |

> **Note:** No API key is required. The entire pipeline (Whisper + Qwen2.5 via Ollama) runs locally. If the polish layer is swapped to Claude Haiku, an `ANTHROPIC_API_KEY` stored in the macOS Keychain via `keytar` would be added here.

---

## UI States

The renderer is a state machine. Each state maps to a distinct visual and determines which user actions are possible.

| State | Trigger | Visible to user |
|---|---|---|
| Idle | App launch / after done | Record button, empty output or last session |
| Recording | `start-recording` | Pulsing red dot, elapsed timer |
| Processing | `stop-recording` fired | Spinner + "Transcribing…" |
| Streaming | First `polish-token` | Text streams in token-by-token; raw transcript collapsed below |
| Error | Any failure | Inline message + specific recovery action |

---

## Error States

Every failure has a specific code and a specific recovery path. Generic error messages are not acceptable.

| Error | Cause | User message |
|---|---|---|
| Mic permission denied | macOS blocked mic | "Open System Settings → Privacy → Microphone" |
| Sidecar not responding | Python process crashed | Auto-restart once; "Restart app if this persists" |
| Model not downloaded | First transcription | Progress bar: "Downloading Whisper model (1.5 GB)…" |
| Empty audio | Nothing captured | "Nothing was captured — try again" |
| Ollama not running | Port 11434 unreachable | "Ollama is not running. Start it with `ollama serve`" |
| Polish failed | Qwen2.5 error or stream interrupted | Show raw transcript + "Polish unavailable" notice |

---

## Development Phases

The build is split into five phases. The first three phases deliver a complete end-to-end demo. Phases 4 and 5 layer on the remaining features.

### Phase 1 — Sidecar
Local Python server: `/health`, `/transcribe` (Whisper), `/polish` (Qwen2.5 SSE).

### Phase 2 — Audio Binary
Swift CLI using AVAudioEngine. Writes `.wav`, controlled via stdin, universal binary.

### Phase 3 — Electron Core
Main process wires up IPC, spawns children, relays HTTP. Renderer implements the dictation state machine with editable output and copy.

> **Milestone: end-to-end demo after Phase 3 — covers all P0 features**

### Phase 4 — P1 Features
Streaming output, transcript history, custom vocabulary, onboarding flow, empty-state UX, full error handling.

### Phase 5 — Stretch Goals
See `5-stretch.md`.

---

## Phase Acceptance Criteria

Each phase must pass all criteria before moving to the next.

### Phase 1 — Sidecar
- ✓ Flask server starts without errors on `localhost:5001`
- ✓ `/health` returns 200 OK
- ✓ `/transcribe` successfully processes a test `.wav` file and returns `{ raw, language, confidence }`
- ✓ `/polish` streams tokens (SSE) and completes with `[DONE]`
- ✓ Qwen2.5 code-switching test: 8/10 utterances preserve English terms (e.g., "MOSFET" not translated)

### Phase 2 — Audio Binary
- ✓ Swift binary compiles without errors
- ✓ `./recorder` captures mic input, writes to `/tmp/vd_recording.wav`, exits cleanly on `stop\n`
- ✓ Output `.wav` plays back correctly in QuickTime or ffplay
- ✓ Universal binary (arm64 + x86_64) created successfully with `lipo`

### Phase 3 — Electron Core
- ✓ Electron app launches
- ✓ Record button triggers `start-recording`, spawns Swift binary
- ✓ Stop button triggers `stop-recording`, waits for transcription, displays raw text
- ✓ Raw text feeds to `/polish`, polish tokens stream to textarea
- ✓ Full loop: speak → transcribe → polish, no hangs, completes in <3 seconds
- ✓ All 5 error codes trigger and display correct messages
- ✓ Processes cleaned up on app quit (no orphans)

### Phase 4 — P1 Features
- ✓ Streaming output visible token-by-token
- ✓ History persists to localStorage (max 100 entries)
- ✓ Vocabulary terms preserved by polish layer
- ✓ First-run modal hides after onboarding
- ✓ Empty-state message shown on cold start
- ✓ All error messages have recovery paths

### Phase 5 — Stretch Goals
- See `5-stretch.md`
