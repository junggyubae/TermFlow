# Reflection

---

## Technical Learnings

- **Electron + Python sidecar** — Manual process lifecycle (health polling, auto-restart on failure). IPC requires `preload.js` bridge.
- **Whisper vocabulary biasing** — `initial_prompt` parameter significantly improves recognition of domain-specific terms.
- **Partial transcription** — 150ms polling loop with `afconvert` to show live results while recording.
- **Swift audio capture** — AVAudioEngine works on a real-time thread; can't do I/O from the callback. WAV header written after capture.
- **macOS packaging is blocked** — Gatekeeper refuses unsigned Python binaries in app bundles. Requires Apple Developer cert ($99/year). Homebrew has tarball checksum instability.
- **SSE streaming** — Flask `text/event-stream`, Anthropic SDK's `messages.stream()`, Node.js custom HTTP parsing.

---

## Process Learnings

- **Planning docs were worth the time** — Never confused about what to build next.
- **Early pivot to Claude Haiku** — Validation testing showed local Qwen2.5 had code-switching failures; switched at planning time, not mid-build.
- **Triage table clarified trade-offs** — "Didn't get to it" vs. "hit a hard constraint" are different.
- **localStorage for persistence** — Fine for prototype; no DB setup needed.

---

## What Worked Well

- Core pipeline is reliable and handles Korean-English code-switching
- Streaming output feels fast
- Auto venv setup removes manual step
- Health polling + auto-restart keeps app stable

---

## Would Do Differently

- Start with simpler UI; get core loop working first
- Plan for macOS signing earlier (if distribution matters)
- Add error logging to file (not just terminal)
- Write pytest tests for sidecar endpoints
