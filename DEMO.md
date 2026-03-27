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
git clone https://github.com/junggyubae/cl_r1
cd cl_r1
chmod +x src/run/run.sh
./src/run/run.sh
```

The launcher script will:
- Check Python 3 and Node.js are installed
- Create a Python venv and install dependencies
- Install Node.js dependencies
- Prompt you for your Anthropic API key (only once — it's saved for future runs)
- Launch the app

**Note on first run:** The Whisper model (~1.5 GB) downloads automatically on first transcription. Subsequent runs load from cache in ~5 seconds. The terminal will show `[Sidecar] Whisper medium loaded in X.Xs` when ready — the UI status also updates to "Press Record or ⌘R".

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

## Known Limitations

- **macOS only** — uses Swift AVAudioEngine and `afconvert` (macOS-only audio tools)
- **Whisper model is large** — medium model is ~1.5 GB; download takes 5-10 min on first run
- **Polish requires internet** — Claude API call requires network; raw transcript still available offline
- **No packaged .app** — must run from source via `npx electron .` (see Stretch Goals section)
