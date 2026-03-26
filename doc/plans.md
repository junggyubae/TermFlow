# Build Plan — Voice Dictation Desktop App (macOS)

## Stack

| Layer | Choice |
|---|---|
| UI | Electron (Node.js + HTML/CSS/JS) |
| Audio Capture | AVAudioEngine (Swift → native binary called by Electron) |
| Transcription | faster-whisper large-v3 (local Python sidecar) |
| LLM Polish | Claude API (claude-haiku-4-5, streamed) |

---

## Architecture

```
[Electron Renderer]
    ↓  IPC (ipcRenderer)
[Electron Main Process]
    ↓  spawn / HTTP
[Swift Audio Binary]         [Python Sidecar :5001]
 AVAudioEngine → .wav    →    /transcribe  (faster-whisper)
                              /polish      (Claude API, streamed)
    ↑  SSE / IPC
[Electron Renderer]
 displays polished text
```

---

## Phase 1 — Python Sidecar (Transcription + Polish)

**Goal:** A local HTTP server that accepts an audio file path and returns clean text.

### Step 1.1 — Set up environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install faster-whisper flask anthropic
```

### Step 1.2 — Transcription endpoint

File: `sidecar/server.py`

- Load `WhisperModel("large-v3", device="cpu", compute_type="int8")`
- `POST /transcribe` — accepts `{ "path": "/tmp/recording.wav" }`
- Call `model.transcribe(path, language=None, vad_filter=True)`
  - `language=None` → auto-detects English, Korean, or mixed
  - `vad_filter=True` → strips silence, reduces hallucination
- Return `{ "raw": "...", "language": "ko"|"en", "confidence": 0.97 }`

### Step 1.3 — Polish endpoint

File: `sidecar/server.py` (same server, second route)

- `POST /polish` — accepts `{ "text": "..." }`
- Call Claude API (`claude-haiku-4-5`) with streaming
- System prompt instructs:
  - Fix punctuation and capitalization
  - Remove filler words (um, uh, 음, 어, 그러니까 as fillers)
  - Preserve code-switching (English terms inside Korean sentences)
  - Do NOT translate — keep original language(s)
  - Return only cleaned text, no commentary
- Stream response back as SSE (`text/event-stream`)

### Step 1.4 — Test sidecar standalone

```bash
python sidecar/server.py
curl -X POST localhost:5001/transcribe -H "Content-Type: application/json" \
  -d '{"path": "/path/to/test.wav"}'
```

---

## Phase 2 — Swift Audio Binary

**Goal:** A small native binary that uses AVAudioEngine to record mic input to a `.wav` file, controllable via stdin commands.

### Step 2.1 — Create Swift CLI target

File: `swift-audio/main.swift`

- On launch: request mic permission, start AVAudioEngine
- Write mic buffers to `/tmp/vd_recording.wav`
- Read from stdin: `"stop\n"` → flush file, print path to stdout, exit

### Step 2.2 — Build binary

```bash
swiftc swift-audio/main.swift -o swift-audio/recorder
```

### Step 2.3 — Test standalone

```bash
./swift-audio/recorder
# speak for a few seconds, then type:
stop
# should print: /tmp/vd_recording.wav
```

---

## Phase 3 — Electron App

**Goal:** A minimal, keyboard-driven UI that ties audio capture and transcription together.

### Step 3.1 — Project scaffold

```bash
mkdir electron-app && cd electron-app
npm init -y
npm install electron electron-builder
```

Directory layout:
```
electron-app/
├── main.js          ← main process: IPC, sidecar management, Swift spawn
├── preload.js       ← contextBridge: exposes safe IPC to renderer
├── renderer/
│   ├── index.html
│   ├── app.js
│   └── style.css
```

### Step 3.2 — Main process responsibilities

File: `main.js`

- On app ready: spawn `python sidecar/server.py` as child process
- On app ready: confirm sidecar is up (`GET /health`)
- IPC handler `start-recording`: spawn `swift-audio/recorder`
- IPC handler `stop-recording`:
  1. Write `"stop\n"` to recorder's stdin
  2. Read `.wav` path from recorder's stdout
  3. `POST /transcribe` → get raw text
  4. `POST /polish` → open SSE stream, forward tokens to renderer via IPC
- On app quit: kill sidecar and recorder processes

### Step 3.3 — Renderer (UI)

File: `renderer/index.html` + `renderer/app.js`

Layout:
```
┌─────────────────────────────────────┐
│  ●  [Record / Stop]   [⌘R shortcut] │
├─────────────────────────────────────┤
│  ✦ Polished Output                  │
│  (editable textarea, streams in)    │
│                         [Copy] [↓]  │
├─────────────────────────────────────┤
│  ▸ Raw transcript (collapsed)       │
└─────────────────────────────────────┘
```

Behavior:
- `⌘R` or button → toggle recording (start/stop)
- While recording: pulsing red dot, waveform or timer
- After stop: show spinner "Transcribing…"
- Polish text streams into the textarea token by token
- `⌘C` copies polished text
- Textarea is editable so user can fix errors

### Step 3.4 — Global keyboard shortcut (optional)

Register `⌘⇧Space` (or user-configurable) as a global hotkey via
`globalShortcut.register()` in main process — starts/stops recording
even when the app is in the background.

---

## Phase 4 — Integration & Wiring

### Step 4.1 — IPC contract

| Channel (main↔renderer) | Direction | Payload |
|---|---|---|
| `start-recording` | renderer → main | — |
| `stop-recording` | renderer → main | — |
| `transcription-raw` | main → renderer | `{ text, language }` |
| `polish-token` | main → renderer | `{ token }` |
| `polish-done` | main → renderer | `{ full }` |
| `error` | main → renderer | `{ message }` |

### Step 4.2 — SSE streaming from sidecar to Electron

```javascript
// main.js — relay polish tokens to renderer window
const response = await fetch('http://localhost:5001/polish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: rawText })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    mainWindow.webContents.send('polish-token', { token: chunk });
}
mainWindow.webContents.send('polish-done', {});
```

### Step 4.3 — End-to-end smoke test

1. Launch app → sidecar starts in background
2. Press `⌘R` → mic light activates
3. Speak mixed Korean-English sentence
4. Press `⌘R` again → spinner appears
5. Raw text appears (collapsed), polished text streams into textarea
6. Press `⌘C` → polished text on clipboard

---

## Phase 5 — Packaging

### Step 5.1 — Bundle sidecar with app

- Add `venv/` and `sidecar/` inside Electron resources dir
- Use `electron-builder` `extraResources` config to include them
- In `main.js`, resolve sidecar path via `process.resourcesPath`

### Step 5.2 — Bundle Swift binary

- Compile `swift-audio/recorder` as a universal binary (arm64 + x86_64)
- Include in `extraResources`
- `chmod +x` on first launch if needed

### Step 5.3 — ANTHROPIC_API_KEY

- On first launch, show a one-time setup modal asking for the key
- Store in macOS Keychain via `keytar` npm package
- Load from Keychain and inject into sidecar environment at spawn time

### Step 5.4 — Build & sign

```bash
npm run build   # electron-builder → dist/
# notarize for macOS Gatekeeper if distributing outside App Store
```

---

## Build Order (Recommended Sequence)

```
Phase 1  →  Phase 2  →  Phase 3 (basic)  →  Phase 4  →  Phase 3 (full UI)  →  Phase 5
Sidecar      Swift        Electron scaffold   Wire it up   Polish UX            Package
(testable    binary       + IPC skeleton      end-to-end
standalone)  (testable
             standalone)
```

---

## Key Files Summary

```
project/
├── sidecar/
│   └── server.py            ← Whisper + Claude API, Flask, SSE
├── swift-audio/
│   └── main.swift           ← AVAudioEngine recorder CLI
├── electron-app/
│   ├── main.js              ← process management, IPC, fetch
│   ├── preload.js           ← contextBridge API
│   └── renderer/
│       ├── index.html
│       ├── app.js
│       └── style.css
├── doc/
│   └── plans.md             ← this file
└── README.md
```

---

## Notes

- **Model first run:** `large-v3` (~1.5 GB) downloads on first transcription call. Show a one-time "Downloading model…" progress state.
- **Latency budget:** AVAudioEngine write ~0ms | Whisper large-v3 ~3–8s for 30s audio on M-series | Claude Haiku first token ~300ms. Total: under 10s for a typical utterance.
- **Korean spacing:** Whisper occasionally mis-spaces Korean morphemes. The Claude polish step corrects this naturally.
- **Mixed-language preservation:** System prompt explicitly forbids translation — English brand names, tech terms, and code-switched phrases stay as spoken.
