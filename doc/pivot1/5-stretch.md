# Stretch Goals

Build these only after P0 and P1 are complete and working. Do not sacrifice core quality for feature count.

---

## Triage

| Stretch Goal | Decision | Reason |
|---|---|---|
| Global hotkey | **Build** | High value, low effort — `globalShortcut` in Electron is a few lines |
| Insertion into active text field | **Skip** | Requires macOS Accessibility API; complex, brittle, high risk to core quality |
| Local/offline-first | **Already done** | Whisper is fully local; only polish requires network |
| Personal dictionary | **Already built** as custom vocabulary (Step 8) | Called out in task; high evaluator weight |
| Reusable text snippets | **Skip** | Scope creep; no clear user need in this flow |
| Tone / cleanup style settings | **Build if time** | Simple dropdown passed to polish prompt — low effort if core is done |
| Packaging for simple install | **Build** | Required for the app to feel complete |

---

## Global Hotkey

Trigger record/stop from any app without focusing the window.

**File:** `electron-app/main.js`

```js
const { globalShortcut } = require('electron')

app.on('ready', () => {
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (state === 'idle') startRecording()
    else if (state === 'recording') stopRecording()
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())
```

---

## Push-to-Talk Mode

Hold a key to record; release to stop.

- Register `keydown` / `keyup` on a configurable key (default: `fn` or user-set)
- On hold: start recording; on release: stop and process
- Can coexist with toggle-to-record — user picks mode in settings

---

## Tone / Cleanup Style Settings

Let the user control how aggressively the polish layer edits.

- Dropdown in settings: `Verbatim` / `Natural` / `Formal`
- Passed as a param in `POST /polish` body
- Sidecar adjusts system prompt per mode:
  - `Verbatim` — fix only punctuation and spacing, keep everything else
  - `Natural` — remove fillers, light cleanup (default)
  - `Formal` — full cleanup, formal register, structured paragraphs

---

## Export Transcript

Save output to file.

- "Export" button in history panel
- Options: `.txt` (plain) or `.md` (with timestamp header)
- Uses Electron's `dialog.showSaveDialog`

---

## Packaging for Simple Install

Ship as a `.dmg` for one-click install.

**File:** `electron-app/package.json` (add `build` config)

```json
"build": {
  "appId": "com.yourname.voicedictation",
  "mac": { "target": "dmg", "arch": ["arm64", "x64"] },
  "extraResources": [
    { "from": "../sidecar", "to": "sidecar" },
    { "from": "../swift-audio/recorder", "to": "recorder" }
  ],
  "entitlements": "entitlements.plist"
}
```

**`entitlements.plist`:**
```xml
<key>com.apple.security.device.audio-input</key><true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
```

**Path resolution in `main.js`:**
```js
const resourcesPath = app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, '..')

const sidecarPath = path.join(resourcesPath, 'sidecar', 'server.py')
const recorderPath = path.join(resourcesPath, 'recorder')
```

```bash
cd electron-app && npm run dist
```
