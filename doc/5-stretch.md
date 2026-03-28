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
| Packaging for simple install | **DONE** | Created `src/run/run.sh` launcher — single command handles venv setup, npm install, API key persistence, and app launch. First run prompts for API key and saves it; subsequent runs reuse it. Simpler than traditional packaging without the complexity of unsigned binary issues. |

---

## What Was Built Beyond P0/P1

- **Streaming polish output** — tokens stream in real-time as Claude generates them (cursor animation)
- **Partial live transcription** — raw text updates every 150ms while recording using Whisper tiny
- **Auto venv setup** — app creates and installs the Python venv on first launch automatically
- **Auto-restart sidecar** — health poller auto-restarts the sidecar once on failure before showing fatal error
- **History persistence** — transcripts survive app restarts via localStorage, with per-card delete and inline edit
- **Custom vocabulary** — terms passed as Whisper `initial_prompt` and injected into the Claude system prompt

---

## Notes on Attempted Goals

**Packaging approach evolved:**
1. First attempted electron-builder + code signing — macOS Gatekeeper blocks unsigned Python binaries inside `.app` bundles. Without an Apple Developer certificate ($99/year), this doesn't simplify install.
2. Then tried Homebrew tap — GitHub tarball checksums kept changing between Homebrew verification steps, making the formula unreliable.
3. **Final solution:** Created `src/run/run.sh` launcher script. Single command (`git clone → chmod → ./src/run/run.sh`) handles all setup automatically. First launch prompts for API key and saves it to `~/.config/termflow/api-key`; subsequent launches reuse it. This is simpler than traditional packaging, more user-friendly than manual setup, and avoids unsigned binary issues entirely.

**Global hotkey** was deprioritized because ⌘R works well when the app is focused, and the app window is small enough to leave visible. A future version could use `globalShortcut` in Electron's main process with a few lines of code.
