# Voice Dictation

A macOS desktop app for Korean-English bilingual voice dictation. Speak naturally in mixed Korean and English — the app transcribes locally using Whisper, then polishes the output with Claude AI while preserving all English technical terms.

---

## What It Does

1. **Record** — click the button or press ⌘R
2. **Transcribe** — Whisper runs locally on your machine (no audio leaves your device)
3. **Polish** — Claude AI cleans up fillers, fixes spacing and punctuation, and preserves English technical terms
4. **Copy** — paste the clean text wherever you need it

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron (Node.js) |
| Audio capture | Swift + AVAudioEngine (compiled binary) |
| Transcription | faster-whisper (Python, runs locally) |
| Polish | Claude Haiku via Anthropic API (streaming SSE) |
| Storage | localStorage (history + vocabulary) |

---

## Architecture

```
┌─────────────────────────────┐
│        Electron App         │
│  renderer/  ←→  main.js     │
└────────────┬────────────────┘
             │ spawn
    ┌────────┴────────┐
    │                 │
┌───▼────┐     ┌──────▼──────┐
│ Swift  │     │  Python     │
│ binary │     │  sidecar    │
│ (audio)│     │  :5001      │
└────────┘     │  Whisper    │
               │  Claude API │
               └─────────────┘
```

- **`src/electron-app/`** — Electron main process + renderer UI
- **`src/sidecar/`** — Flask server running Whisper and calling Claude API
- **`src/swift-audio/`** — Swift CLI that captures mic input and writes `.wav` files

---

## Features

- Korean-only, English-only, and mixed Korean-English transcription
- Real-time partial transcription while recording
- Token-by-token streaming polish output
- Custom vocabulary — terms are preserved exactly in both transcription and polish
- Transcript history with inline editing and per-entry delete
- Auto-download and setup of Python venv on first launch
- Auto-restart of backend sidecar on failure

---

## Setup

See **[SETUP.md](SETUP.md)** for full instructions.

Quick version:
```bash
# Python deps
cd src/sidecar && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt && deactivate && cd ../..

# Node deps
cd src/electron-app && npm install && cd ../..

# Run
cd src/electron-app
export ANTHROPIC_API_KEY="sk-ant-YOUR_KEY_HERE"
export WHISPER_MODEL=medium
npx electron .
```

---

## Privacy

- Audio is captured and transcribed **entirely on-device** using Whisper — no audio is ever uploaded
- Transcribed text is sent to Anthropic's Claude API for polishing — disclosed in the UI
- No analytics, no telemetry, no external services beyond the Claude API

---

## Documentation

| File | Contents |
|---|---|
| `doc/1-product.md` | Product requirements and user definition |
| `doc/2-decision.md` | Technology choices and trade-offs |
| `doc/3-plan.md` | Architecture and phase plan |
| `doc/4-build.md` | Step-by-step implementation guide |
| `doc/5-stretch.md` | Stretch goals — what was built, what was skipped |
| `doc/6-reflection.md` | What I learned building this |
| `DEMO.md` | Demo guide for evaluators |
