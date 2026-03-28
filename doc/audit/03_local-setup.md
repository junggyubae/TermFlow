# TermFlow Local Setup Audit

Date: 2026-03-28

## Executive Summary

This document records every issue encountered while setting up and running TermFlow locally from a fresh clone. The session started from SETUP.md instructions on a macOS 15 (Darwin 24.6.0) Apple Silicon machine with Node v22, Python 3.14, and uv 0.9.12 available. Four distinct blockers were found, plus one latent bug exposed during testing. All were resolved in-session.

Overall assessment: the project runs once the issues below are addressed, but a first-time contributor following SETUP.md would hit multiple blockers before seeing the app work. The most impactful problems were a binary incompatibility in the Swift recorder and a silent hang in the polish pipeline.

---

## Environment

| Component | Version |
|-----------|---------|
| macOS | 15.x (Darwin 24.6.0) |
| Node.js | v22.22.1 |
| Python | 3.14.3 |
| uv | 0.9.12 |
| Swift | 6.1 (swiftlang-6.1.0.110.21) |
| Electron | 33.x (local), 41.1.0 (npx fallback) |

---

## Issue 1: Python Dependency Management (Migration)

**Severity:** Low (pre-existing design debt, not a blocker with manual steps)

**Symptom:** SETUP.md and `src/run/run.sh` use `python3 -m venv` + `pip install -r requirements.txt`. This works but is slow and fragile — no lockfile, no deterministic resolution, and venv creation on Python 3.14 pulls in bleeding-edge packages.

**Root Cause:** The project predated uv adoption and used the stdlib venv workflow.

**Fix Applied:**
- Created `src/sidecar/pyproject.toml` with dependencies declared under `[project]`
- Replaced `requirements.txt` and manual venv creation with `uv sync`
- Updated `src/run/run.sh` to use `uv sync --quiet` (with a check for uv availability)
- Updated `src/electron-app/main.js` `setupVenv()` → `setupPython()` to call `uv sync` instead of `python3 -m venv` + `pip install`
- Updated path constants: `VENV_DIR`/`VENV_PYTHON` → `UV_PYTHON` pointing to `.venv/bin/python3` inside `SIDECAR_DIR`
- Updated `.gitignore` and `package.json` electron-builder filter to reference `.venv` instead of `venv`
- Updated SETUP.md prerequisites and manual instructions

**Files Changed:**
- `src/sidecar/pyproject.toml` (new)
- `src/sidecar/requirements.txt` (deleted)
- `src/sidecar/main.py` (deleted, uv scaffold artifact)
- `src/run/run.sh`
- `src/electron-app/main.js`
- `src/electron-app/package.json`
- `.gitignore`
- `SETUP.md`

---

## Issue 2: EPIPE Uncaught Exception Crashes App

**Severity:** High (blocks all usage — error dialog steals focus and prevents interaction)

**Symptom:** Repeated "Uncaught Exception: Error: write EPIPE" dialog boxes popping up continuously, making the app unusable. The error pointed to `main.js:75` (the `sidecarProcess.stderr.on("data")` handler).

**Root Cause:** When the sidecar process's stdio pipes close (e.g., during shutdown, restart, or if a pipe buffer fills), `console.log`/`console.error` calls in the stream data handlers throw EPIPE errors. Node.js has no built-in suppression for writes to broken pipes. With no `process.on("uncaughtException")` handler and no `error` event listener on the child process streams, these bubbled up as fatal uncaught exceptions that Electron rendered as blocking dialog boxes.

**Fix Applied:**
1. Wrapped `console.log`/`console.error` calls in sidecar stdout/stderr data handlers with try-catch
2. Added `error` event listeners on `sidecarProcess.stdout` and `sidecarProcess.stderr` to swallow pipe errors
3. Added a global `process.on("uncaughtException")` handler that silently ignores EPIPE errors and logs all others

**Files Changed:**
- `src/electron-app/main.js`

---

## Issue 3: Swift Recorder Binary Incompatible With Host OS

**Severity:** Critical (recording completely non-functional — clicking Record does nothing)

**Symptom:** Pressing the Record button or ⌘R did nothing. The status text showed "Press Record or ⌘R" (confirming the sidecar was ready), but no recording started. No error was shown in the UI.

**Root Cause:** The committed `src/swift-audio/recorder` binary was compiled for macOS 26.0 (a newer SDK/OS version). Running it on macOS 15.x failed at dyld load time:

```
dyld: Library not loaded: /usr/lib/swift/libswift_DarwinFoundation2.dylib
Referenced from: recorder (built for macOS 26.0 which is newer than running OS)
```

The `recorderProcess.on("error")` handler in main.js sent an error event to the renderer, but the recorder spawn failure was silent in the UI because the error happened at the dyld level before the process could emit structured output. The Electron `spawn` call succeeded (the binary exists and is executable), but the process crashed immediately.

**Fix Applied:**
- Recompiled the recorder from `src/swift-audio/main.swift` using the local Swift toolchain:
  ```
  swiftc -O -o recorder main.swift -framework AVFoundation -framework CoreAudio
  ```
- This produced a binary targeting the host's macOS 15.0, which runs correctly.

**Recommendation:** The recorder binary should not be committed to the repository. Instead, the build step should be part of setup (in `run.sh` or a Makefile). Alternatively, document the minimum macOS version and provide binaries for supported OS versions.

**Files Changed:**
- `src/swift-audio/recorder` (recompiled)

---

## Issue 4: Polish Pipeline Hangs On Empty Transcription

**Severity:** High (app freezes at "Polishing" with no way to recover except quitting)

**Symptom:** After a short recording, the app displayed "Polishing..." indefinitely. No error was shown, and the UI became stuck.

**Root Cause:** Two compounding issues:

1. **No empty-text guard before polish:** When Whisper returned an empty transcription (short/silent recording), `main.js` called `streamPolish("")` without checking if `result.raw` was empty.

2. **streamPolish doesn't handle non-SSE responses:** The `/polish` endpoint returns `{"error": "Empty text"}` with HTTP 400 for empty input — a plain JSON response, not an SSE stream. But `streamPolish()` unconditionally parses the response as SSE, looking for `data: [DONE]` lines. Since a JSON error response never contains that sentinel, the Promise never resolves or rejects, hanging the entire pipeline.

**Fix Applied:**
1. Added an empty-text guard before calling `streamPolish`: if `result.raw` is falsy or whitespace-only, emit `polish-done` with empty text and return immediately.
2. Added HTTP status code checking in `streamPolish`: if the response status is not 200, read the body as JSON, extract the error message, send it to the renderer, and reject the Promise.

**Files Changed:**
- `src/electron-app/main.js`

---

## Issue 5: npx Electron Version Mismatch

**Severity:** Low (causes confusion, not a hard blocker)

**Symptom:** Running `npx electron .` downloaded Electron 41.1.0 globally instead of using the locally installed v33.x from `node_modules`. This caused a delay and version inconsistency.

**Root Cause:** `npx` resolves to the global/remote package when the local binary isn't found in `PATH`. The `package.json` specifies `electron` as a devDependency, but running `npx electron .` from the wrong directory or without the local `node_modules/.bin` in PATH triggers a fresh download.

**Workaround Used:** Launched directly via `./node_modules/.bin/electron .` from `src/electron-app/`.

**Recommendation:** The `run.sh` launcher should use `npx --no-install electron .` or invoke the local binary directly to avoid this.

---

## Summary Table

| # | Issue | Severity | Category | Status |
|---|-------|----------|----------|--------|
| 1 | pip/venv → uv migration | Low | Build tooling | Fixed |
| 2 | EPIPE uncaught exception | High | Runtime stability | Fixed |
| 3 | Recorder binary OS mismatch | Critical | Binary compatibility | Fixed (local rebuild) |
| 4 | Polish hangs on empty input | High | Error handling | Fixed |
| 5 | npx downloads wrong Electron | Low | Dev workflow | Workaround applied |

---

## Recommendations

1. **Don't commit compiled binaries.** Add `src/swift-audio/recorder` to `.gitignore` and add a build step to `run.sh`.
2. **Add a timeout to streamPolish.** Even with the status code fix, network issues could still cause indefinite hangs.
3. **Lock Python dependencies.** `uv sync` generates a `uv.lock` — commit it for reproducible installs.
4. **Pin the npx invocation.** Use `npx --no-install electron .` or the local binary path in `run.sh`.
5. **Surface recorder spawn failures in the UI.** The current `recorderProcess.on("error")` handler sends an error event, but dyld failures may not trigger it reliably. Consider a health check after spawn.
