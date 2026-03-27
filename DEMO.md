# Demo Guide for Evaluators

This guide is for graders and evaluators assessing the Voice Dictation app. It covers what was built, how to run it, and what to look for when testing each requirement.

---

## What Was Built

A macOS desktop app for Korean-English bilingual voice dictation. The user speaks naturally in mixed Korean and English, and the app returns clean, paste-ready text.

**Core pipeline:**
1. User presses record → Swift binary captures mic input
2. User presses stop → faster-whisper transcribes locally
3. Claude Haiku polishes the transcript (removes fillers, fixes spacing, preserves English terms)
4. Result streams token-by-token into the UI

---

## Setup (Required Before Testing)

See **SETUP.md** for full instructions. Quick version:

```bash
# 1. Install Python dependencies
cd src/sidecar
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..

# 2. Install Node dependencies
cd src/electron-app
npm install
cd ../..

# 3. Run
cd src/electron-app
export ANTHROPIC_API_KEY="sk-ant-YOUR_KEY_HERE"
export WHISPER_MODEL=medium
npx electron .
```

**Note on first run:** The Whisper model (~1.5 GB) downloads automatically on first transcription. Subsequent runs load from cache in ~5 seconds. The terminal will show `[Sidecar] Whisper medium loaded in X.Xs` when ready — the UI status also updates to "Press Record or ⌘R".

---

## Feature Checklist

### P0 — Core Requirements

**Toggle-to-record**
- Click the Record button or press **⌘R** to start and stop
- Button label and status text update to reflect state (Listening → Transcribing → Polishing → Done)

**Multilingual transcription**
- Test with Korean-only, English-only, and mixed Korean-English speech
- Suggested phrase: *"GitHub에서 merge conflict 나면 rebase하거나 merge해야 돼"*
- Expected: English terms (GitHub, merge conflict, rebase) preserved exactly; Korean cleaned

**Transcription output**
- Raw Whisper output shown in "Raw" section
- Polished Claude output streams in below it

**LLM polish layer**
- Filler words removed: 음, 어, 그러니까, um, uh
- Korean spacing corrected
- Punctuation added
- English technical terms preserved exactly (not translated)

**Editable output**
- Click "Edit" next to any polished transcript to edit inline
- Click "Done" to save the edit

**Copy to clipboard**
- "Copy" button next to Raw and Polished sections
- **⌘C** copies the current polished transcript when no text is selected

**Error handling**
- If the sidecar fails, it auto-restarts once before showing a fatal error
- Error messages appear in a dismissible banner

---

### P1 — Strongly Preferred

**Streaming output**
- Polished text streams token-by-token as Claude generates it (not displayed all at once)
- A blinking cursor appears while streaming

**Transcript history**
- Click "+ Show History" to open the history panel
- Past transcripts persist across app restarts (stored in localStorage)
- Each entry has: timestamp, raw text, polished text, Copy button, Edit button, Delete button
- "Delete All History" button at the bottom

**Custom vocabulary**
- Click "+ Show Custom Vocabulary" to open the vocab panel
- Type a term and press Enter to add it
- Terms are passed to both Whisper (as `initial_prompt`) and Claude (injected into system prompt)
- Test: add "regularization", record *"regularization is important in machine learning"* — term should appear exactly as typed
- Per-term delete button; "Delete All" button available

**Korean-English code-switching**
- Core requirement — see multilingual transcription test above
- The polish layer is explicitly instructed never to translate; output language must match input language

**Privacy-conscious architecture**
- Audio is captured and transcribed entirely on-device (Whisper, no upload)
- Only the text transcript is sent to Claude API for polishing
- No audio ever leaves the machine

**Empty state UX**
- On first launch (no history), history panel shows "No history yet"
- Status shows "Loading Server" while sidecar is starting, then "Press Record or ⌘R" when ready

---

### P2 — Stretch Goals

| Goal | Status | Notes |
|---|---|---|
| Global hotkey | **Skipped** | ⌘R works in-window; global requires additional Electron permissions |
| Push-to-talk | **Skipped** | Toggle-to-record covers the use case |
| Tone/style settings | **Skipped** | Deprioritized after core pipeline scope |
| Export transcript | **Skipped** | Copy-to-clipboard covers primary need |
| Packaging (.dmg) | **Skipped** | macOS Gatekeeper blocks unsigned Python binaries in app bundles; requires Apple Developer cert |
| Live partial transcription | **Built** (not in original spec) | Raw text updates every 150ms during recording using Whisper tiny |

---

## Suggested Test Script (10 minutes)

**Test 1 — English:**
Record: *"The quick brown fox jumps over the lazy dog, um, you know"*
Expected: Filler words (um, you know) removed, punctuation correct

**Test 2 — Korean:**
Record: *"안녕하세요 저는 음 개발자입니다 그래서 뭐 열심히 일하고 있어요"*
Expected: Fillers (음, 그래서, 뭐) removed, Korean spacing correct

**Test 3 — Code-switching (core feature):**
Record: *"머신러닝에서 overfitting을 regularization으로 방지할 수 있어"*
Expected: "overfitting" and "regularization" preserved exactly; Korean unchanged

**Test 4 — Custom vocabulary:**
- Open vocab panel, add "overfitting"
- Record the same phrase as Test 3
- Expected: "overfitting" preserved exactly (vocabulary boost confirms the term)

**Test 5 — History and edit:**
- Open history panel — all 4 recordings should appear
- Click Edit on any entry, modify the polished text, click Done
- Restart the app — confirm history persists

**Test 6 — Keyboard shortcuts:**
- Press **⌘R** to start/stop (instead of clicking)
- Press **⌘C** (with nothing selected) to copy current transcript

---

## Architecture Overview

```
Electron (main.js)
  ├── spawns Swift binary (src/swift-audio/recorder) for mic capture
  ├── spawns Python sidecar (src/sidecar/server.py) for transcription + polish
  ├── polls /health every 500ms; auto-restarts sidecar on failure
  └── bridges IPC between renderer and sidecar via localhost HTTP

Python sidecar (Flask, port 5001)
  ├── GET  /health         → { status: "ok" }
  ├── POST /transcribe     → { raw, language, confidence }
  └── POST /polish         → SSE stream of { token } + [DONE]
```

---

## Known Limitations

- **macOS only** — uses Swift AVAudioEngine and `afconvert` (macOS-only audio tools)
- **Whisper model is large** — medium model is ~1.5 GB; download takes 5-10 min on first run
- **Polish requires internet** — Claude API call requires network; raw transcript still available offline
- **No packaged .app** — must run from source via `npx electron .` (see Stretch Goals section)
