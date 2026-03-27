# Decisions

**This document defines the WHY of architectural choices: the trade-offs evaluated and the decisions made.**

Each section covers one architectural choice: what the options were, how they compare, and what was chosen and why.

---

## Constraints & Assumptions

**User constraints:**
- macOS-only (uses AVAudioEngine, which is macOS-native)
- Requires Anthropic API key for LLM polish (Claude Haiku)
- Whisper transcription runs fully local (~1.5 GB model download)

**Timeline & scope:**
- 36-hour take-home project
- Solo developer
- P0 + P1 features required; P2 is stretch

---

## UI Framework

The UI layer is what the user sees and interacts with — the record button, output area, and history panel.

| | Electron | SwiftUI |
|---|---|---|
| Dev speed | ✅ Fast iteration, no recompile | ❌ Recompile on every UI change |
| Native feel | ❌ Non-native look | ✅ Looks and feels macOS-native |
| UI complexity | ✅ Minimal UI — record button + textarea | ✅ Also fine for simple UI |
| Web ecosystem | ✅ HTML/CSS/JS — familiar | ❌ Swift-only |

→ **Electron.** The UI is minimal so the native-feel gap is small. Dev speed matters more in a 36-hour window.

---

## Audio Capture

The audio capture layer records mic input and writes it to a file that Whisper can read.

| | AVAudioEngine (Swift binary) | Web Audio API (Electron) |
|---|---|---|
| macOS mic permissions | ✅ Handled via `Info.plist`, reliable | ❌ Inconsistent in Electron sandbox |
| Output format | ✅ Clean `.wav`, controllable | ⚠️ Extra conversion steps needed |
| Integration | ✅ Simple stdin/stdout control from main process | ✅ In-process, no subprocess |
| Complexity | ⚠️ Requires compiling a Swift binary | ✅ No separate binary |

→ **AVAudioEngine via Swift CLI.** Mic permission handling on macOS is reliable via the native path. The subprocess interface (stdin/stdout) is simple enough to be worth it.

---

## Transcription

The transcription layer converts recorded audio into raw text. This is where Korean, English, and mixed-language accuracy is determined.

| | faster-whisper large-v3 (local) | Cloud API (e.g. Whisper API, Deepgram) |
|---|---|---|
| Korean + code-switching accuracy | ✅ Best-in-class | ⚠️ Variable, depends on provider |
| Privacy | ✅ Audio never leaves the machine | ❌ Audio sent to third-party servers |
| Cost | ✅ Free after model download | ❌ Per-minute billing |
| Latency | ✅ No network round-trip | ⚠️ Adds ~500ms–1s |
| Setup | ⚠️ 1.5 GB model download on first run | ✅ No setup |

→ **faster-whisper large-v3, local.** Privacy, cost, and Korean accuracy all favour local. `int8` quantization keeps it fast enough on Apple Silicon.

---

## Live Transcription Model Size

For partial (live) transcription — shown while the user is still speaking — a separate, smaller Whisper model is used to keep up with real-time audio. The final transcription after recording stops always uses `large-v3`.

| | tiny | base | small |
|---|---|---|---|
| Speed on standard Mac | ✅ Fast enough to feel live | ⚠️ Slight lag noticeable | ❌ Latency breaks live feel |
| RAW text accuracy | ❌ Noticeably worse | ✅ Good | ✅ Better |
| Live UX feel | ✅ Text keeps up with speech | ⚠️ Borderline | ❌ Feels delayed |

→ **tiny.** The live transcription display exists to give the user immediate feedback that the app is working — not to produce accurate text (that's the final model's job). `tiny` is the only model fast enough on a standard Mac to maintain the "live" feel. On a machine with more headroom, `base` or `small` are worth trying for better intermediate accuracy.

---

## Language Detection

Whisper can either be told which language to expect, or left to detect it automatically from the first 30 seconds of audio.

| | `language=None` (auto-detect) | Explicit per-session selection |
|---|---|---|
| UX | ✅ Zero friction — user just speaks | ❌ Extra step before every recording |
| Mixed-language speech | ✅ Handles code-switching naturally | ❌ Forces a single language, breaks mixing |
| Monolingual accuracy | ✅ Detects correctly in first 30s | ✅ Explicit is always correct |

→ **`language=None`.** Forcing a language selection defeats the core product goal. Auto-detection handles both monolingual and mixed speech well.

---

## LLM Polish

The polish layer takes raw Whisper output and turns it into clean, readable text — fixing punctuation, removing fillers, correcting Korean spacing, and preserving code-switching.

| | Claude Haiku (API) |
|---|---|
| Korean + English quality | ✅ Best-in-class bilingual quality |
| Code-switching preservation | ✅ Very reliable — preserves English terms in Korean sentences |
| Privacy | ⚠️ Text sent to Anthropic servers (audio stays local) |
| Cost | ⚠️ ~$0.001 per transcript (~negligible) |
| Offline support | ❌ Requires network on every request |
| Latency | ✅ ~300ms to first token |
| Setup | ✅ API key only |

→ **Claude Haiku (API).** A local model (Qwen2.5 7B) was initially considered but failed validation testing with 35% accuracy on Korean code-switching — Chinese character contamination, English term translation to Korean phonetics, and meta-confusion. See `doc/pivot1/reason.md` for full evidence.

Claude Haiku handles Korean natively with no language confusion, reliable term preservation, and precise instruction following. Audio transcription (Whisper) remains fully local — only the text transcript is sent for polishing. Cost is negligible (~$0.001/transcript). The API key is stored securely in macOS Keychain via `keytar`. If the API is unavailable, the raw Whisper transcript is shown directly.

---

## Polish Delivery

Once the polish model starts generating, there are two ways to send the output to the UI: wait for the full response, or stream it token-by-token as it generates.

| | Streaming (SSE) | Batch response |
|---|---|---|
| Perceived latency | ✅ Text appears immediately as it generates | ❌ Full wait before anything shows |
| UX feel | ✅ Feels fast and responsive | ❌ Feels slow after recording stops |
| Implementation | ⚠️ SSE stream relayed through IPC | ✅ Simpler single response |

→ **Streaming SSE.** The gap between recording stop and seeing text is the most sensitive moment in the UX. Streaming makes that gap feel shorter than it is.

---

## Transcript Storage

Past transcripts need to be saved somewhere so the user can access their history. The two options are `localStorage` — the browser-side key-value store built into Electron — and SQLite, a file-based relational database.

| | localStorage | SQLite |
|---|---|---|
| Setup | ✅ Zero — built into Electron | ⚠️ `npm install better-sqlite3` + native module |
| Storage limit | ⚠️ ~5–10MB total | ✅ No practical limit |
| Query / filter | ❌ Load full array every read | ✅ SQL — filter by date, language, etc. |
| Complexity | ✅ Simple get/set | ⚠️ Schema, migrations |

→ **localStorage.** 100 short transcript entries sits well within the size limit. No filtering or search is needed — history is a flat list, newest first. SQLite's complexity isn't justified by the feature set.

---

## Sidecar Web Framework

Electron runs on Node.js and cannot call Python directly. The sidecar is a small Python HTTP server that bridges the two — Electron sends requests to it, and it runs Whisper and calls the Claude Haiku API. Flask and FastAPI are both Python libraries that create this HTTP server.

The key difference is how they handle waiting: Flask is synchronous (one thing at a time), FastAPI is asynchronous (can handle multiple requests simultaneously). For a single-user local app, this distinction doesn't matter.

| | Flask | FastAPI |
|---|---|---|
| Streaming (SSE) | ⚠️ Manual setup required | ✅ Native `StreamingResponse` |
| Async / concurrency | ❌ Synchronous, one request at a time | ✅ Handles concurrent requests |
| Simplicity | ✅ Minimal boilerplate | ⚠️ More structure required |
| Dependencies | ✅ `flask` only | ⚠️ `fastapi` + `uvicorn` |

→ **Flask.** The sidecar serves one user, one request at a time — async concurrency adds no value here. Flask's manual streaming setup is a few extra lines, not a real burden. The sidecar relays Claude Haiku's streaming response as SSE to Electron.

---

## Audio File Handling

The Swift recorder writes mic input to `/tmp/vd_recording.wav`. Once Whisper finishes transcription, the file has no further use.

→ **Delete immediately after transcription.** Leaving audio files on disk after use contradicts the privacy-conscious architecture. The main process deletes the `.wav` as soon as `/transcribe` returns, before the polish step begins.

---

## Risk Summary

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Claude API availability / rate limits** | MEDIUM | Haiku has generous limits. If API is down, show raw transcript with "Polish unavailable" notice. |
| **Electron IPC + process orchestration** | HIGH | Build throwaway proof-of-concept for spawning Swift binary + polling sidecar health before committing to Phase 3. |
| **Whisper model download fails or hangs** | MEDIUM | Document recovery UX (resume download, or clear cache and re-download). |
| **API key management / security** | MEDIUM | Store in macOS Keychain via `keytar`. Never persist in localStorage or files. |
| **Swift compilation on first attempt** | MEDIUM | Verify toolchain before Phase 2. Test universal binary build early. |

**Critical path:** Phases 1–3 must work flawlessly. Phase 4 (P1 features) adds robustness; if squeezed for time, Phases 1–3 can ship without Phase 4.
