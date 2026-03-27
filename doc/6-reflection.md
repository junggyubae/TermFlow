# Reflection

What I learned building this project.

---

## What the Project Was

A macOS voice dictation desktop app for Korean-English bilingual users. The core challenge: most dictation tools fail on code-switched speech (Korean sentences with embedded English technical terms). This app combines local Whisper transcription with Claude API polishing to handle that case cleanly.

Built over roughly one week as a solo project.

---

## Technical Learnings

### Electron + Python sidecar architecture
I hadn't built a desktop app with a Python backend before. The pattern of spawning a Flask server from Electron's main process and communicating via localhost HTTP is simple but has sharp edges:
- Process lifecycle management is manual — you have to kill the sidecar on quit, handle crashes, and avoid zombie processes
- Health polling is necessary because there's no clean "sidecar is ready" signal; I implemented a 500ms health interval with auto-restart on 3 consecutive failures
- IPC between main process and renderer requires an explicit bridge (`preload.js` with `contextBridge`) — you can't call Node APIs directly from the renderer

### Whisper vocabulary biasing
Whisper has an `initial_prompt` parameter that biases transcription toward specific terms. Passing custom vocabulary as a comma-separated `initial_prompt` significantly improves recognition of domain-specific terms (medical terms, engineering terms). This was a non-obvious technique I found by looking at how other tools handled it.

### Partial transcription while recording
I implemented a 150ms polling loop that takes a snapshot of the raw audio file, converts it to WAV, and runs Whisper tiny on it to show live partial results. This involved:
- Using `afconvert` (macOS built-in) to convert the raw PCM to WAV format on the fly
- Running a low-quality Whisper tiny model for speed (not shown to user as final result)
- Handling the race condition where the final transcription overwrites the partial

### Swift audio capture
Writing a Swift CLI that captures mic input via AVAudioEngine and writes to a raw PCM file was more involved than expected. Key learnings:
- AVAudioEngine works on a real-time audio thread — you can't do I/O or locking from the callback
- The WAV format requires a header; I wrote the header after capture rather than inline
- Microphone permission must be requested at runtime via `AVCaptureDevice.requestAccess`, not just declared in entitlements

### macOS app packaging is hard without a developer certificate
I spent significant time trying to distribute the app as a `.app` bundle using electron-builder. The technical setup (extraResources, path resolution in packaged vs. dev mode) worked fine. The blocker was macOS Gatekeeper: it refuses to run unsigned Python binaries inside an app bundle. Proper signing requires an Apple Developer Program membership ($99/year) for code signing and notarization. Without it, the app can't be distributed as a package — it has to run from source. This was a real-world constraint I didn't anticipate at planning time.

### SSE streaming from Python to Electron
Streaming Claude's output token-by-token required:
- Flask response with `text/event-stream` content type
- Anthropic SDK's `messages.stream()` context manager
- Custom HTTP request handling in Node.js (Electron's `http` module, not fetch) that buffers partial lines and parses SSE `data:` events
- The renderer appending tokens incrementally to show a typing cursor effect

---

## Process Learnings

### Planning documents were worth the time
I wrote product requirements, decision docs, architecture plans, and step-by-step build guides before writing any code. This felt slow at first, but it meant I was never confused about what to build next. When I pivoted (from a different initial approach), updating the docs clarified exactly what had changed and what hadn't.

### The pivot happened early and was the right call
The original plan used a different model approach. After initial validation testing showed the local model had code-switching failures (Chinese contamination, term translation), I switched to Claude Haiku for polishing. This pivot happened at planning time, not mid-build, which saved a lot of rework. The doc/pivot1/ folder preserves the original plan for reference.

### Stretch goals should be in the triage table from the start
I initially had "Packaging for simple install" as a definite build goal. The triage table in 5-stretch.md now shows it as skipped with a clear reason. Having the reason written down matters — it distinguishes "I didn't get to it" from "I tried and hit a hard constraint."

### localStorage for persistence is fine for a prototype
Using `localStorage` for history and vocabulary was the right call for a one-week project. It requires no database setup, survives app restarts, and is easy to inspect in DevTools. The downside (data tied to the Electron app's profile directory) is acceptable at this scope.

---

## What Worked Well

- **The core pipeline works reliably** — record → transcribe → polish is solid and handles Korean-English code-switching as intended
- **Streaming output feels fast** — even though total latency from stop to done is 3-5 seconds, showing tokens as they arrive makes it feel immediate
- **Auto venv setup removes a setup step** — first-time users don't need to manually run `pip install`; the app does it on first launch
- **The sidecar health + auto-restart pattern** — keeps the app from getting stuck in a broken state without user action

## What I'd Do Differently

- **Start with a simpler UI** — I spent time on history, vocab panel, and UI polish that could have come later. Getting the core loop working and tested first would have been faster.
- **Plan for macOS signing earlier** — Packaging was never going to work without a developer certificate. If distribution mattered, I'd have investigated this at the start.
- **Add error logging to a file** — When the sidecar fails, the only place to see why is the terminal. A log file would make debugging much easier.
- **Write tests for the sidecar** — The Flask endpoints have no tests. A few pytest cases for the polish prompt behavior would have caught regressions.
