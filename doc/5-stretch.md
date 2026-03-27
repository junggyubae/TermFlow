# Stretch Goals

Build these only after P0 and P1 are complete and working. Do not sacrifice core quality for feature count.

---

## Triage

| Stretch Goal | Decision | Reason |
|---|---|---|
| Global hotkey | **SKIP** | ⌘R works in-window; global hotkey requires extra Electron permissions and was deprioritized to focus on core stability |
| Insertion into active text field | **SKIP** | Requires macOS Accessibility API; complex, brittle, high risk to core quality |
| Local/offline-first | **DONE** | Whisper is fully local; only polish requires network |
| Personal dictionary | **DONE** | Built as custom vocabulary panel (collapsible, per-term delete, Enter to add) |
| Reusable text snippets | **SKIP** | Scope creep; no clear user need in this flow |
| Tone / cleanup style settings | **SKIP** | Ran out of time; core pipeline took longer than expected |
| Push-to-talk mode | **SKIP** | Not implemented; toggle-to-record covers the use case well |
| Export transcript | **SKIP** | Not implemented; copy-to-clipboard covers the primary need |
| Packaging for simple install | **SKIP** | Attempted — electron-builder works but macOS Gatekeeper blocks unsigned Python binaries inside .app bundles. Without an Apple Developer certificate, packaging doesn't simplify install. App runs cleanly via `npx electron .` instead. |

---

## What Was Built Beyond P0/P1

- **Streaming polish output** — tokens stream in real-time as Claude generates them (cursor animation)
- **Partial live transcription** — raw text updates every 150ms while recording using Whisper tiny
- **Auto venv setup** — app creates and installs the Python venv on first launch automatically
- **Auto-restart sidecar** — health poller auto-restarts the sidecar once on failure before showing fatal error
- **History persistence** — transcripts survive app restarts via localStorage, with per-card delete and inline edit
- **Custom vocabulary** — terms passed as Whisper `initial_prompt` and injected into the Claude system prompt

---

## Notes on Skipped Items

**Packaging** was the most-attempted skip. The attempt revealed that macOS code signing is a hard requirement for distributing apps with embedded binaries — not just a nice-to-have. The app uses a Python interpreter (unsigned) inside the bundle, which macOS Gatekeeper blocks regardless of entitlements. A proper solution would require an Apple Developer Program membership ($99/year) for signing and notarization. The dev-mode run (`npx electron .`) is fully functional and was used for all testing.

**Global hotkey** was deprioritized because ⌘R works well when the app is focused, and the app is small enough to leave visible. A future version could use `globalShortcut` in Electron's main process with a few lines of code.
