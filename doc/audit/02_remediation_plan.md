# TermFlow Security Remediation Plan

Date: 2026-03-28
Depends on: [01_vulnerability.md](/Users/pureicis/dev/TermFlow/doc/audit/01_vulnerability.md)

## Purpose

This document translates the audit findings into an implementation-oriented remediation plan. It is intentionally detailed and includes:

- remediation goals
- exact files likely to change
- conservative fix path and redesign path
- code scaffolding examples
- validation strategy
- rollout sequencing
- risks and tradeoffs

The plan is written so an engineer can use it directly to implement the fixes without reconstructing intent from the audit report.

## Remediation Strategy Summary

There are two parallel planning tracks in this document:

### Track A: Minimal-Risk Hardening

This path preserves the current architecture wherever possible and reduces immediate risk quickly.

Primary characteristics:

- keep Electron + Python sidecar + Swift recorder structure
- keep HTTP communication initially
- add authentication and tighter validation to the sidecar
- remove unsafe DOM patterns
- replace plaintext key storage
- improve temp-file cleanup and state ownership

Recommended use:

- fastest safe path for a prototype moving toward internal or limited release
- lowest migration cost
- smallest change surface

### Track B: Security-Focused Redesign

This path tightens trust boundaries rather than only patching them.

Primary characteristics:

- replace public localhost service assumptions with app-owned IPC or private socket transport
- remove dynamic installation from runtime
- reduce renderer privilege and data persistence
- package dependencies in a deterministic way

Recommended use:

- if the product is expected to ship broadly
- if privacy/security posture matters materially
- if future features will increase attack surface

### Recommendation

Implement Track A immediately, but make the Track A fixes compatible with Track B. In practice this means:

1. Fix XSS and secret storage first.
2. Introduce request authentication and strict file validation before changing transport.
3. Use those changes as the stepping stone toward a Unix domain socket or equivalent app-private channel.
4. Remove runtime dependency installation before general distribution.

## Priority Matrix

| Priority | Topic | Track A | Track B |
| --- | --- | --- | --- |
| P0 | Renderer XSS | Required immediately | Required immediately |
| P0 | API key storage | Required immediately | Required immediately |
| P1 | Sidecar trust boundary | Add auth token + path allowlist | Replace localhost HTTP with private transport |
| P1 | Runtime installs | Pin and constrain | Package fully, remove runtime install |
| P2 | Temp file cleanup | Add cleanup manager | Add cleanup manager |
| P2 | History state lifecycle | Add stable IDs and local ownership | Same fix |
| P2 | Privacy persistence | Add settings and retention | Add settings and consider encrypted storage |
| P3 | Port-kill behavior | Remove broad kill logic | Eliminated naturally by redesign |

## System Overview Before Changes

Current flow:

1. Electron main launches sidecar on fixed port `5001`
2. Renderer triggers main-process IPC actions through preload
3. Main process reads vocab out of renderer `localStorage` via `executeJavaScript`
4. Main process records audio using Swift helper
5. Main process sends temp-file paths to Flask over localhost HTTP
6. Sidecar transcribes audio and optionally calls Anthropic for transcript polishing

Primary trust boundary weaknesses:

- renderer content can influence DOM and privilege bridge
- any local process can talk to Flask
- file path trust is too loose
- secret storage is not OS-backed
- runtime package installation changes behavior post-build

## Workstream 1: Remove Renderer XSS And Reduce Renderer Trust

### Goal

Eliminate script injection opportunities from transcript, history, and vocabulary content, and reduce the renderer’s ability to serve as a privilege escalation point.

### Relevant Files

- [src/electron-app/renderer/app.js](/Users/pureicis/dev/TermFlow/src/electron-app/renderer/app.js)
- [src/electron-app/preload.js](/Users/pureicis/dev/TermFlow/src/electron-app/preload.js)
- [src/electron-app/main.js](/Users/pureicis/dev/TermFlow/src/electron-app/main.js)
- [src/electron-app/renderer/index.html](/Users/pureicis/dev/TermFlow/src/electron-app/renderer/index.html)

### Track A: Minimal-Risk Hardening

#### Changes

1. Replace all untrusted `innerHTML` writes with DOM construction and `textContent`.
2. Separate decorative cursor rendering from transcript content.
3. Stop interpolating user/model values into HTML templates.
4. Keep `contextIsolation: true` and add `sandbox: true` if compatible.
5. Remove `executeJavaScript`-based localStorage reads if possible in the same pass.

#### Hotspots To Fix

- vocab list item rendering
- history card rendering
- current polished transcript streaming

#### Suggested Refactor Pattern

Instead of:

```js
item.innerHTML = `
  <span class="vocab-item-text">${term}</span>
  <div class="vocab-item-actions">
    <button class="vocab-btn vocab-delete">Delete</button>
  </div>
`;
```

Use:

```js
function createVocabItem(term) {
  const item = document.createElement("div");
  item.className = "vocab-item";

  const text = document.createElement("span");
  text.className = "vocab-item-text";
  text.textContent = term;

  const actions = document.createElement("div");
  actions.className = "vocab-item-actions";

  const del = document.createElement("button");
  del.className = "vocab-btn vocab-delete";
  del.type = "button";
  del.textContent = "Delete";

  actions.appendChild(del);
  item.appendChild(text);
  item.appendChild(actions);
  return item;
}
```

Instead of:

```js
currentPolish.innerHTML = currentPolished + '<span class="cursor"></span>';
```

Use:

```js
function renderStreamingPolish(container, text) {
  container.replaceChildren();

  const textNode = document.createElement("span");
  textNode.textContent = text;

  const cursor = document.createElement("span");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");

  container.appendChild(textNode);
  container.appendChild(cursor);
}
```

#### Additional Hardening

If Electron version and app behavior allow it, update browser window options:

```js
webPreferences: {
  preload: path.join(__dirname, "preload.js"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}
```

#### Validation

- try vocab entries containing `<img src=x onerror=alert(1)>`
- seed localStorage history with HTML payloads and reload
- simulate polished transcript text containing HTML or SVG payloads
- verify transcript still renders correctly and no handlers execute

### Track B: Security-Focused Redesign

#### Changes

1. Move all renderer data writes through explicit render helpers only.
2. Replace ambient `window.api` surface with a narrower API object organized by capability.
3. Remove all `executeJavaScript` calls from the main process and replace them with explicit request/response IPC.
4. Add a Content Security Policy in `index.html` even for local files.

#### Suggested Preload Shape

```js
contextBridge.exposeInMainWorld("termflow", {
  recording: {
    start: () => ipcRenderer.send("recording:start"),
    stop: () => ipcRenderer.send("recording:stop"),
  },
  clipboard: {
    writeText: (text) => ipcRenderer.send("clipboard:write-text", String(text)),
  },
  settings: {
    requestState: () => ipcRenderer.invoke("settings:get"),
    saveVocab: (terms) => ipcRenderer.invoke("settings:set-vocab", terms),
  },
  events: {
    onPolishToken: (fn) => subscribe("polish:token", fn),
    onPolishDone: (fn) => subscribe("polish:done", fn),
  },
});
```

#### Suggested CSP

Add to `index.html`:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none';"
/>
```

#### Validation

- verify no code path still relies on `executeJavaScript`
- verify CSP does not break app rendering
- verify event subscriptions still work under sandbox mode

### Implementation Notes

This workstream should be done before any sidecar hardening because it removes the most direct app-level exploit path and stabilizes the renderer contract for later changes.

## Workstream 2: Replace Plaintext API Key Storage

### Goal

Store secrets in an OS-backed secret store and stop persisting API keys in plaintext configuration files.

### Relevant Files

- [src/run/run.sh](/Users/pureicis/dev/TermFlow/src/run/run.sh)
- [src/electron-app/package.json](/Users/pureicis/dev/TermFlow/src/electron-app/package.json)
- [src/electron-app/main.js](/Users/pureicis/dev/TermFlow/src/electron-app/main.js)
- [doc/2-decision.md](/Users/pureicis/dev/TermFlow/doc/2-decision.md)
- [doc/4-build.md](/Users/pureicis/dev/TermFlow/doc/4-build.md)

### Track A: Minimal-Risk Hardening

#### Changes

1. Use `keytar` in the Electron main process to persist and retrieve `ANTHROPIC_API_KEY`.
2. Stop saving new keys to `~/.config/termflow/api-key`.
3. On first secure startup, import any legacy plaintext key and then delete the file.
4. Pass the key to the sidecar only for the process lifetime.

#### Suggested Main-Process Service

```js
const keytar = require("keytar");

const SERVICE = "TermFlow";
const ACCOUNT = "anthropic-api-key";

async function getApiKey() {
  return keytar.getPassword(SERVICE, ACCOUNT);
}

async function setApiKey(value) {
  if (!value || typeof value !== "string") {
    throw new Error("API key must be a non-empty string");
  }
  await keytar.setPassword(SERVICE, ACCOUNT, value.trim());
}

async function deleteApiKey() {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
```

#### Legacy Migration Scaffolding

```js
async function migrateLegacyApiKey() {
  const configDir = path.join(os.homedir(), ".config", "termflow");
  const legacyPath = path.join(configDir, "api-key");

  if (!fs.existsSync(legacyPath)) return;
  const alreadyStored = await getApiKey();
  if (alreadyStored) return;

  const legacyValue = fs.readFileSync(legacyPath, "utf8").trim();
  if (!legacyValue) return;

  await setApiKey(legacyValue);
  fs.unlinkSync(legacyPath);
}
```

#### Sidecar Startup Injection

Minimal version:

```js
const apiKey = await getApiKey();
sidecarProcess = spawn(VENV_PYTHON, [SIDECAR_SCRIPT], {
  env: {
    ...process.env,
    ANTHROPIC_API_KEY: apiKey || "",
  },
  stdio: ["pipe", "pipe", "pipe"],
});
```

This still exposes the key to the sidecar environment during process lifetime. It is better than plaintext disk storage, but not the strongest design.

### Track B: Security-Focused Redesign

#### Changes

1. Keep the key only in the Electron main process.
2. Never put the key in the child process environment.
3. Proxy polish requests through the main process, or hand the sidecar a per-session secret/token rather than the raw API key.
4. Optionally move Anthropic access entirely out of Python and into main-process Node code.

#### Example: Main Process Owns Anthropic Call

```js
ipcMain.handle("polish:stream", async (_, { text, vocab }) => {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("Missing API key");

  const client = new Anthropic({ apiKey });
  // stream response here and forward chunks to renderer
});
```

This removes the sidecar’s need to know about the API key at all.

#### Validation

- verify legacy plaintext file is migrated and deleted
- verify app still works with no file in `~/.config/termflow`
- verify key is absent from renderer, localStorage, and logs
- inspect child environment behavior if Track A is used

## Workstream 3: Constrain Or Replace The Localhost Sidecar Boundary

### Goal

Reduce the trust boundary from "any local process" to "this app instance only."

### Relevant Files

- [src/electron-app/main.js](/Users/pureicis/dev/TermFlow/src/electron-app/main.js)
- [src/sidecar/server.py](/Users/pureicis/dev/TermFlow/src/sidecar/server.py)
- [src/swift-audio/main.swift](/Users/pureicis/dev/TermFlow/src/swift-audio/main.swift)

### Track A: Minimal-Risk Hardening

#### Changes

1. Keep HTTP temporarily.
2. Generate a per-launch auth token in Electron main.
3. Inject the token into the sidecar environment.
4. Require that token in every `/health`, `/transcribe`, and `/polish` request.
5. Move from fixed port `5001` to a random available localhost port.
6. Stop killing arbitrary processes by port.
7. Restrict transcribe paths to app-created temp artifacts.

#### Suggested Main-Process Token

```js
const crypto = require("crypto");

const SIDECAR_AUTH_TOKEN = crypto.randomBytes(32).toString("hex");
```

#### Suggested Sidecar Auth Check

```python
from flask import abort, request

SIDECAR_AUTH_TOKEN = os.environ.get("SIDECAR_AUTH_TOKEN", "")

def require_auth():
    supplied = request.headers.get("X-TermFlow-Token", "")
    if not SIDECAR_AUTH_TOKEN or supplied != SIDECAR_AUTH_TOKEN:
        abort(403)

@app.before_request
def enforce_auth():
    require_auth()
```

#### Suggested Random-Port Allocation

Main process example:

```js
const net = require("net");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : null;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on("error", reject);
  });
}
```

Spawn sidecar:

```js
const port = await getFreePort();
sidecarProcess = spawn(VENV_PYTHON, [SIDECAR_SCRIPT], {
  env: {
    ...process.env,
    SIDECAR_PORT: String(port),
    SIDECAR_AUTH_TOKEN,
  },
  stdio: ["pipe", "pipe", "pipe"],
});
```

Sidecar bind:

```python
port = int(os.environ.get("SIDECAR_PORT", "5001"))
app.run(host="127.0.0.1", port=port, threaded=True, debug=False)
```

Request helper:

```js
function sidecarHeaders(body) {
  return {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "X-TermFlow-Token": SIDECAR_AUTH_TOKEN,
  };
}
```

#### Strict Path Allowlisting

Main process should track app-generated files:

```js
const managedAudioFiles = new Set();

function trackManagedFile(filePath) {
  managedAudioFiles.add(path.resolve(filePath));
}

function untrackManagedFile(filePath) {
  managedAudioFiles.delete(path.resolve(filePath));
}
```

Sidecar validation should reject anything else:

```python
def is_allowed_audio_path(wav_path: str) -> bool:
    allowed_root = os.environ.get("TERMFLOW_AUDIO_TMPDIR")
    if not allowed_root:
        return False
    real_path = os.path.realpath(wav_path)
    real_root = os.path.realpath(allowed_root)
    return real_path.startswith(real_root + os.sep)
```

This is not perfect if the root is too broad. The safest Track A version is to use a dedicated app-owned temp directory, not the global temp root.

### Track B: Security-Focused Redesign

#### Changes

1. Replace public localhost HTTP with one of:
   - Unix domain socket
   - stdio RPC
   - Node child-process message channel
2. Remove general-purpose HTTP server semantics entirely.
3. Define a narrow request/response protocol that only the parent process can use.
4. Move polish calls to the main process if sidecar does not need them.

#### Preferred Option

For this app, the best redesign is:

- Swift recorder remains a child process
- Python sidecar becomes a long-lived stdio child process or Unix socket server
- Electron main remains the only orchestrator
- renderer never knows transport details

#### Example: Stdio RPC Envelope

Parent sends:

```json
{"id":"1","method":"transcribe","params":{"path":"/tmp/app/audio/123.wav","vocab":["MOSFET"]}}
```

Child returns:

```json
{"id":"1","result":{"raw":"...","language":"ko","confidence":0.97}}
```

Error form:

```json
{"id":"1","error":{"code":"FILE_NOT_ALLOWED","message":"Rejected path"}}
```

#### Python Skeleton

```python
import json
import sys

def send(msg):
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()

for line in sys.stdin:
    request = json.loads(line)
    method = request.get("method")
    if method == "transcribe":
        # validate params, run model, send result
        send({"id": request["id"], "result": {...}})
```

#### Node Skeleton

```js
function callSidecar(method, params) {
  const id = crypto.randomUUID();
  const payload = JSON.stringify({ id, method, params }) + "\n";
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    sidecarProcess.stdin.write(payload);
  });
}
```

#### Validation

- ensure no external process can reach the sidecar interface
- verify only main-process initiated requests succeed
- fuzz invalid messages and paths
- verify streaming behavior still works for polish if retained in Python

## Workstream 4: Remove Runtime Package Installation And Make Builds Reproducible

### Goal

Stop changing executable dependencies at app startup and move to deterministic packaging.

### Relevant Files

- [src/electron-app/main.js](/Users/pureicis/dev/TermFlow/src/electron-app/main.js)
- [src/run/run.sh](/Users/pureicis/dev/TermFlow/src/run/run.sh)
- [src/sidecar/requirements.txt](/Users/pureicis/dev/TermFlow/src/sidecar/requirements.txt)
- [src/electron-app/package.json](/Users/pureicis/dev/TermFlow/src/electron-app/package.json)

### Track A: Minimal-Risk Hardening

#### Changes

1. Pin Python dependencies to exact versions.
2. Remove `pip install` from normal packaged-app startup.
3. Keep startup venv creation only for explicit development mode if absolutely necessary.
4. Update launch docs so dependency installation is setup-time, not run-time.

#### Example Pinned Requirements

```txt
faster-whisper==1.1.1
flask==3.1.0
anthropic==0.49.0
```

Prefer a generated lock process over hand-maintaining this forever, but exact pins are the minimum.

#### Environment Split

```js
const IS_DEV = !app.isPackaged;

if (IS_DEV) {
  await setupDevVenv();
} else {
  startSidecarWithBundledRuntime();
}
```

### Track B: Security-Focused Redesign

#### Changes

1. Bundle the Python runtime and dependencies with the shipped app.
2. Build the recorder and sidecar artifacts ahead of time.
3. Treat the packaged app as immutable.
4. Optionally evaluate replacing Python sidecar responsibilities with a native or Node-based component if that materially reduces packaging complexity.

#### Example Packaging Direction

- build Python venv or frozen app during CI
- place runtime in `extraResources`
- launch bundled interpreter directly
- never call `pip install` or `npm install` from app startup

#### Validation

- install app on a clean machine with no Python tooling
- verify app starts offline
- verify dependency versions match release manifest

## Workstream 5: Add Reliable Temp-File Lifecycle Management

### Goal

Ensure audio snapshots, raw recordings, and converted WAV files are always cleaned up.

### Relevant Files

- [src/electron-app/main.js](/Users/pureicis/dev/TermFlow/src/electron-app/main.js)
- [src/swift-audio/main.swift](/Users/pureicis/dev/TermFlow/src/swift-audio/main.swift)

### Track A And Track B

This workstream is the same in both tracks.

#### Changes

1. Create an app-owned temp directory for audio artifacts.
2. Track all created files in one cleanup manager.
3. Use `try/finally` in all transcribe/polish flows.
4. Clean managed files on success, failure, and app shutdown.

#### Suggested Cleanup Manager

```js
const managedTempFiles = new Set();

function registerTempFile(filePath) {
  const resolved = path.resolve(filePath);
  managedTempFiles.add(resolved);
  return resolved;
}

async function safeDelete(filePath) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  managedTempFiles.delete(resolved);
  try {
    await fs.promises.unlink(resolved);
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      console.warn("[TempCleanup] unlink failed:", resolved, err.message);
    }
  }
}

async function cleanupAllTempFiles() {
  await Promise.all([...managedTempFiles].map((file) => safeDelete(file)));
}
```

#### Pipeline Example

```js
let wavPath = "";
try {
  wavPath = registerTempFile(recorderStdout.trim());
  const result = await postJSON("/transcribe", { path: wavPath, vocab });
  if (result.error) throw new Error(result.error);
  await streamPolish(result.raw, vocab);
} finally {
  await safeDelete(wavPath);
}
```

#### App Shutdown

```js
app.on("window-all-closed", async () => {
  clearInterval(healthInterval);
  stopPartialTranscribeLoop();
  stopSidecar();
  if (recorderProcess) recorderProcess.kill();
  await cleanupAllTempFiles();
  app.quit();
});
```

#### Validation

- force errors in transcription and confirm temp files are removed
- force errors in polish and confirm temp files are removed
- crash recorder and confirm orphan cleanup on next launch if needed

## Workstream 6: Fix Renderer State Ownership And History Identity

### Goal

Remove fragile global DOM references and stop identifying history entries by transcript text.

### Relevant Files

- [src/electron-app/renderer/app.js](/Users/pureicis/dev/TermFlow/src/electron-app/renderer/app.js)

### Track A And Track B

This workstream is the same in both tracks.

#### Changes

1. Add a stable ID to each history entry.
2. Capture card-local nodes inside each card’s handlers.
3. Remove or minimize `activeCard`, `activeRawEl`, `activePolishEl`, and related globals.
4. Update storage mutations to operate by ID, not transcript text.

#### Entry Shape

```js
function createHistoryEntry(raw, polished, language) {
  return {
    id: crypto.randomUUID(),
    raw,
    polished,
    language,
    timestamp: Date.now(),
  };
}
```

#### Safe Delete Pattern

```js
function removeHistoryEntry(entryId) {
  const key = "vd_history";
  const hist = loadHistory();
  const next = hist.filter((entry) => entry.id !== entryId);
  localStorage.setItem(key, JSON.stringify(next));
}
```

#### Card Binding Pattern

```js
function bindCardActions(card, entry) {
  const rawEl = card.querySelector("[data-raw]");
  const polishEl = card.querySelector("[data-polish]");
  const deleteBtn = card.querySelector(".btn-delete-card");

  deleteBtn.addEventListener("click", () => {
    removeHistoryEntry(entry.id);
    card.remove();
    syncHistoryEmptyState();
  });
}
```

#### Validation

- create duplicate raw transcript entries and verify delete/edit affect only one
- create many entries and verify no stale global references are needed
- verify copy/edit handlers keep working

## Workstream 7: Reduce Sensitive Persistence And Add Privacy Controls

### Goal

Make transcript retention explicit and configurable rather than implicit.

### Relevant Files

- [src/electron-app/renderer/app.js](/Users/pureicis/dev/TermFlow/src/electron-app/renderer/app.js)
- [src/electron-app/renderer/index.html](/Users/pureicis/dev/TermFlow/src/electron-app/renderer/index.html)
- possibly new settings storage module in main/preload

### Track A: Minimal-Risk Hardening

#### Changes

1. Add a simple setting: `saveHistory`
2. Default to current behavior or disable by default depending on product decision
3. Add retention limit and a clear "history stored locally" message

#### Suggested Setting Shape

```js
{
  saveHistory: false,
  maxHistoryEntries: 100
}
```

#### Gate Persistence

```js
function saveToHistory(raw, polished, language) {
  const settings = loadSettings();
  if (!settings.saveHistory) return;
  // existing save logic
}
```

### Track B: Security-Focused Redesign

#### Changes

1. Move settings out of renderer-localStorage and into a main-process owned config layer.
2. Consider separate handling for vocabulary and transcript history.
3. If retention becomes a product feature, consider encryption-at-rest only if there is a real key-management story.

Encryption without a sound key-management design will not materially help, so this is lower priority than eliminating implicit retention.

#### Validation

- verify history is not persisted when disabled
- verify retention settings survive app restart
- verify "Delete All" behaves correctly with IDs

## Workstream 8: Remove Broad Port-Kill Logic

### Goal

Stop terminating unrelated local processes.

### Relevant Files

- [src/electron-app/main.js](/Users/pureicis/dev/TermFlow/src/electron-app/main.js)

### Track A

If HTTP remains, random-port allocation removes most need for this behavior. Track only the child process you launched and kill only that process.

#### Suggested Replacement

```js
function stopSidecar() {
  if (!sidecarProcess) return;
  sidecarProcess.kill();
  sidecarProcess = null;
}
```

### Track B

This issue disappears once the sidecar is no longer a public fixed-port localhost server.

## Suggested Implementation Order

### Phase 0: Foundation

1. Create a branch dedicated to hardening.
2. Add test harnesses where possible:
   - renderer unit-style DOM tests if available
   - sidecar request tests
   - process integration smoke tests
3. Add a security checklist file for release validation.

### Phase 1: Highest Risk

1. Workstream 1: remove renderer XSS paths
2. Workstream 2: replace plaintext key storage
3. Workstream 5: temp-file cleanup manager

These three can largely proceed independently, though the key-storage UI/API changes may touch startup flow.

### Phase 2: Trust Boundary Hardening

1. Workstream 3 Track A: auth token + random port + path allowlist
2. Workstream 8: remove port-kill logic
3. Workstream 6: stable history IDs and card ownership cleanup

### Phase 3: Packaging And Privacy

1. Workstream 4 Track A or B depending on release target
2. Workstream 7 privacy settings
3. Electron sandbox/CSP compatibility pass

### Phase 4: Redesign Upgrade

Only after the hardening baseline is stable:

1. Workstream 3 Track B: move sidecar to stdio or private socket
2. Workstream 2 Track B: keep Anthropic access in main process
3. Remove residual HTTP assumptions from architecture docs

## Suggested Task Breakdown For Implementation

### Batch 1: Renderer Safety

- replace streaming transcript rendering helper
- replace vocab item HTML template
- replace history card HTML interpolation for untrusted values
- add CSP and test renderer behavior

### Batch 2: Secret Storage

- add keytar-backed get/set/delete helpers
- add migration from legacy plaintext file
- update startup flow to read secure key
- remove plaintext save path from launcher

### Batch 3: Sidecar Guardrails

- add auth token generation
- add authenticated request helper
- bind sidecar to dynamic localhost port
- add allowed-audio-root validation
- remove port-kill logic

### Batch 4: Cleanup And State

- add managed temp-file registry
- move deletion into `finally`
- add history IDs
- remove delete-by-raw-text logic

### Batch 5: Distribution Hardening

- pin Python dependencies
- split dev startup from packaged startup
- package sidecar runtime deterministically

## Test Plan

### Security Validation

1. Renderer injection tests
   - transcript payload with HTML tag
   - transcript payload with event handler
   - vocab payload with HTML
   - localStorage-seeded malicious history entry

2. Sidecar auth tests
   - request without token returns `403`
   - request with wrong token returns `403`
   - request with valid token succeeds

3. Path validation tests
   - temp file inside app-owned directory succeeds
   - arbitrary file outside allowed root fails
   - symlink escape attempt fails

4. Secret handling tests
   - no plaintext file created on new setup
   - legacy file migrated once then removed
   - key absent from renderer-visible storage

### Lifecycle Validation

1. temp WAV removed on successful transcription
2. temp WAV removed when `/transcribe` errors
3. temp WAV removed when polish errors
4. history delete/edit operates by ID correctly
5. app shutdown cleans all managed temp files

### Packaging Validation

1. packaged app starts without running `pip install`
2. packaged app starts without fixed-port kill logic
3. clean-machine startup works with bundled dependencies

## Documentation Updates Required

When implementation begins, update:

- [doc/2-decision.md](/Users/pureicis/dev/TermFlow/doc/2-decision.md)
- [doc/4-build.md](/Users/pureicis/dev/TermFlow/doc/4-build.md)
- [SETUP.md](/Users/pureicis/dev/TermFlow/SETUP.md)
- [README.md](/Users/pureicis/dev/TermFlow/README.md)

Topics to align:

- actual secret storage behavior
- actual sidecar transport and auth model
- actual runtime/dependency model
- privacy and retention behavior

## Recommended Final Architecture

If the project is intended to mature beyond prototype stage, the recommended endpoint architecture is:

1. Renderer
   - no HTML injection of untrusted values
   - minimal preload API
   - no secret access

2. Electron Main
   - owns secret storage
   - owns process lifecycle
   - owns sidecar transport
   - owns file tracking and cleanup

3. Sidecar
   - no public localhost trust model
   - only accepts parent-initiated requests
   - only reads app-owned temp files

4. Packaging
   - deterministic dependencies
   - no startup install behavior
   - no runtime mutation of core executable environment

## Proposed Next Deliverables

After this document, the next useful artifacts would be:

1. `doc/audit/03_task_breakdown.md`
   - issue-by-issue implementation tickets

2. `doc/audit/04_validation_checklist.md`
   - release and regression checklist

3. a code change sequence beginning with:
   - renderer safety
   - secure key storage
   - sidecar request auth
