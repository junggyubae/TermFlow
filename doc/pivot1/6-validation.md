# Validation Testing Protocol

**Purpose:** Before Phase 1 coding, validate three critical unknowns.
**Timeline:** 5–7 hours total
**Success Criteria:** All three tests pass. If any fails, pivot or document workaround before Phase 1.

---

## Test 1 — Qwen2.5 Code-Switching Accuracy

**Objective:** Confirm Qwen2.5 preserves English technical terms inside Korean sentences at 95%+ accuracy.

**Test Set:** 20 utterances across four domains (5 per domain)

### Medical (Bilingual Technical Terms)
1. "cardiovascular disease에서 hypertension이 atherosclerosis progression에 어떤 영향을 주는지 pathophysiology 중심으로 설명해줘"
2. "myocardial infarction의 pathophysiology를 설명하고 troponin 레벨이 왜 증가하는지 말해줘"
3. "COPD와 asthma의 차이점을 급성 exacerbation 관점에서 설명해줘"
4. "sepsis의 inflammatory cascade를 cytokine 관점에서 단계별로 설명해줘"
5. "pneumonia와 bronchitis의 radiographic findings를 구분해서 설명해줘"

### Engineering (Circuit/Physics Terms)
1. "MOSFET이 saturation region에서 동작할 때 threshold voltage는 어떻게 결정되는가"
2. "impedance matching이 RF circuit에서 왜 중요한지 S-parameter 기준으로 설명해줘"
3. "bipolar junction transistor의 active region과 saturation region을 공학적으로 비교해줘"
4. "operational amplifier의 frequency response와 bandwidth를 Bode plot으로 분석해줘"
5. "signal integrity 문제가 high-speed PCB design에서 왜 발생하는지 설명해줘"

### Computer Science (Code/API Terms)
1. "GitHub에서 merge conflict를 해결하는 방법을 rebase와 merge 관점에서 설명해줘"
2. "REST API의 idempotency를 HTTP method 관점에서 설명하고 예시를 줘"
3. "SQL injection vulnerability를 parameterized query로 어떻게 방어하는지 설명해줘"
4. "load balancer가 distributed system에서 latency를 어떻게 최적화하는지 말해줘"
5. "NoSQL database의 ACID compliance 부재가 왜 문제인지 transaction 관점에서 설명해줘"

### General (Mixed Technical + Daily)
1. "인공지능 시대에 ChatGPT 같은 generative model이 왜 hallucination 현상을 보이는지 설명해줘"
2. "5G network의 latency가 4G보다 낮은 이유를 bandwidth와 spectrum 관점에서 설명해줘"
3. "blockchain의 consensus algorithm인 proof-of-work와 proof-of-stake의 차이를 설명해줘"
4. "cryptocurrency의 smart contract가 Ethereum에서 어떻게 security vulnerability를 만드는지 설명해줘"
5. "machine learning model의 overfitting 문제를 regularization 기법으로 어떻게 해결하는지 말해줘"

### Acceptance Criteria

**Pass if:**
- ≥19/20 utterances have English terms preserved exactly (case + spacing + no partial translation)
- No English term is replaced with Korean equivalent (e.g., "MOSFET" must remain "MOSFET", not "금속산화물반도체" or "MOSFET이" mixed)
- Fillers removed (음, 어, 그러니까, um, uh)
- Output reads naturally in mixed language

**Example output validation:**
```
Input:  "MOSFET이 saturation region에서 동작할 때는은..."
Output: "MOSFET이 saturation region에서 동작할 때는,"
Check:  ✓ "MOSFET" preserved exactly
        ✓ "saturation region" preserved exactly
        ✓ filler "은" removed
        ✓ natural reading
Result: PASS
```

**Fail if:**
- <19/20 (80% or lower) — indicates Qwen2.5 not suitable; must switch to Claude Haiku fallback
- Terms are partially translated or case-mangled

### Running the Test

**Prerequisites:**
```bash
ollama serve  # Terminal 1: Keep running
ollama pull qwen2.5:7b  # If not already downloaded (~5 min)
```

**Test script** (`sidecar/test_qwen_codeswitching.py`):
```python
import requests
import json

utterances = [
    # [paste all 20 test utterances from above]
]

def test_utterance(raw_text):
    """Run through Qwen2.5 polish endpoint"""
    response = requests.post(
        "http://localhost:11434/api/chat",
        json={
            "model": "qwen2.5:7b",
            "messages": [
                {
                    "role": "system",
                    "content": """Fix punctuation, capitalization, and remove fillers.
Preserve English technical terms exactly as written.
Output only the cleaned text, no commentary."""
                },
                {"role": "user", "content": raw_text}
            ],
            "stream": False
        }
    )
    return response.json()["message"]["content"]

passed = 0
for i, utterance in enumerate(utterances, 1):
    result = test_utterance(utterance)
    print(f"\n[{i}] Input:  {utterance}")
    print(f"    Output: {result}")
    # Manually verify: are all English terms preserved?
    # Mark as PASS or FAIL

print(f"\n=== RESULT: {passed}/20 PASSED ===")
print(f"Acceptance: {'✓ PASS (≥19/20)' if passed >= 19 else '✗ FAIL (<19/20)'}")
```

**Run:**
```bash
cd sidecar && python test_qwen_codeswitching.py
```

**Log results** to `doc/validation-results.md` with:
- Test date/time
- Qwen2.5 version (should be qwen2.5:7b)
- Pass count
- Any failed examples + why

---

## Test 2 — SSE Streaming from Ollama

**Objective:** Confirm tokens arrive incrementally (not buffered) and measure latency.

**Test script** (`sidecar/test_sse_streaming.py`):
```python
import requests
import time

def test_streaming():
    """Test if Ollama streams tokens incrementally"""
    start = time.time()
    tokens = []
    first_token_time = None

    response = requests.post(
        "http://localhost:11434/api/chat",
        json={
            "model": "qwen2.5:7b",
            "messages": [
                {"role": "user", "content": "Write a 50-word explanation of machine learning"}
            ],
            "stream": True
        },
        stream=True
    )

    for line in response.iter_lines():
        if not line:
            continue

        elapsed = time.time() - start
        data = json.loads(line)

        if "message" in data and "content" in data["message"]:
            token = data["message"]["content"]
            tokens.append((token, elapsed))

            if first_token_time is None and token.strip():
                first_token_time = elapsed

    total_time = time.time() - start

    print(f"Streaming Test Results:")
    print(f"  Total tokens: {len(tokens)}")
    print(f"  Time to first token: {first_token_time:.3f}s")
    print(f"  Total time: {total_time:.3f}s")
    print(f"  Token count: {len(tokens)}")
    print(f"  Average latency per token: {total_time / len(tokens):.3f}s")

    # Verify tokens arrived incrementally (not all at once)
    if first_token_time < 1.0 and len(tokens) > 5:
        print(f"\n✓ PASS: Tokens arrive incrementally (first token at {first_token_time:.3f}s)")
        return True
    else:
        print(f"\n✗ FAIL: Tokens appear buffered or latency too high")
        return False

test_streaming()
```

**Run:**
```bash
cd sidecar && python test_sse_streaming.py
```

**Acceptance Criteria:**
- ✓ First token within 500ms of request
- ✓ Tokens arrive incrementally (multiple tokens spread over time, not single buffered chunk)
- ✓ Total latency <3 seconds for 50-word response

**Expected output:**
```
Streaming Test Results:
  Total tokens: 47
  Time to first token: 0.287s
  Total time: 2.156s
  Token count: 47
  Average latency per token: 0.046s

✓ PASS: Tokens arrive incrementally (first token at 0.287s)
```

**Log results** to `doc/validation-results.md`.

---

## Test 3 — IPC + Process Orchestration PoC

**Objective:** Verify no deadlocks, orphan processes, or hangs when spawning Swift binary + polling sidecar + relaying SSE.

### Prototype Structure

This is a **throwaway Electron app** (delete after testing). Purpose is purely to validate process management.

**Setup:**
```bash
mkdir -p /tmp/vd-poc && cd /tmp/vd-poc
npm init -y
npm install electron
touch main.js preload.js renderer.js renderer.html
```

**File: `main.js`**
```javascript
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

let mainWindow;
let swiftProcess = null;
let polishStream = null;

app.on("ready", () => {
  mainWindow = new BrowserWindow({
    webPreferences: { preload: __dirname + "/preload.js" }
  });
  mainWindow.loadFile("renderer.html");

  // Health polling
  setInterval(() => {
    http.get("http://localhost:5001/health", (res) => {
      mainWindow.webContents.send("sidecar-status", {
        status: res.statusCode === 200 ? "ready" : "error"
      });
    }).on("error", () => {
      mainWindow.webContents.send("sidecar-status", { status: "error" });
    });
  }, 500);
});

ipcMain.on("start-recording", () => {
  console.log("[Main] Starting recorder...");
  swiftProcess = spawn("./recorder", []);
  swiftProcess.on("error", (err) => {
    console.error("[Main] Recorder spawn error:", err);
    mainWindow.webContents.send("error", {
      code: "RECORDER_FAILED",
      message: err.message
    });
  });
});

ipcMain.on("stop-recording", () => {
  if (!swiftProcess) return;
  console.log("[Main] Stopping recorder...");
  swiftProcess.stdin.write("stop\n");

  let output = "";
  swiftProcess.stdout.on("data", (data) => {
    output += data.toString();
  });

  swiftProcess.on("close", (code) => {
    const wavPath = output.trim();
    console.log("[Main] Recorder exited, WAV path:", wavPath);

    // POST /transcribe
    const req = http.request("http://localhost:5001/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const transcript = JSON.parse(body);
        console.log("[Main] Transcription raw:", transcript.raw);
        mainWindow.webContents.send("transcription-raw", {
          text: transcript.raw,
          language: transcript.language
        });

        // POST /polish with SSE
        const polishReq = http.request(
          "http://localhost:5001/polish",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          },
          (res) => {
            let buffer = "";
            res.on("data", (chunk) => {
              buffer += chunk.toString();
              const lines = buffer.split("\n");
              buffer = lines.pop(); // Keep incomplete line

              lines.forEach((line) => {
                if (line.startsWith("data: ")) {
                  const json = line.slice(6);
                  if (json === "[DONE]") {
                    console.log("[Main] Polish complete");
                    mainWindow.webContents.send("polish-done", {});
                  } else {
                    try {
                      const parsed = JSON.parse(json);
                      console.log("[Main] Polish token:", parsed.token);
                      mainWindow.webContents.send("polish-token", {
                        token: parsed.token
                      });
                    } catch (e) {
                      // Ignore parse errors
                    }
                  }
                }
              });
            });
          }
        );

        polishReq.write(
          JSON.stringify({
            text: transcript.raw,
            vocab: []
          })
        );
        polishReq.end();
      });
    });

    req.write(JSON.stringify({ path: wavPath }));
    req.end();

    swiftProcess = null;
  });
});

app.on("quit", () => {
  if (swiftProcess) swiftProcess.kill();
});
```

**File: `preload.js`**
```javascript
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  startRecording: () => ipcRenderer.send("start-recording"),
  stopRecording: () => ipcRenderer.send("stop-recording"),
  onSidecarStatus: (fn) =>
    ipcRenderer.on("sidecar-status", (event, data) => fn(data)),
  onTranscriptionRaw: (fn) =>
    ipcRenderer.on("transcription-raw", (event, data) => fn(data)),
  onPolishToken: (fn) =>
    ipcRenderer.on("polish-token", (event, data) => fn(data)),
  onPolishDone: (fn) =>
    ipcRenderer.on("polish-done", (event, data) => fn(data)),
  onError: (fn) => ipcRenderer.on("error", (event, data) => fn(data))
});
```

**File: `renderer.html`**
```html
<!DOCTYPE html>
<html>
<head>
  <title>VD PoC</title>
  <style>
    body { font-family: mono; margin: 20px; }
    button { padding: 10px 20px; }
    #output { border: 1px solid #ccc; padding: 10px; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Voice Dictation PoC</h1>
  <p>Sidecar Status: <span id="status">—</span></p>
  <button onclick="startRecording()">Record</button>
  <button onclick="stopRecording()">Stop</button>
  <div id="output"></div>

  <script>
    let isRecording = false;

    function startRecording() {
      window.api.startRecording();
      isRecording = true;
    }

    function stopRecording() {
      window.api.stopRecording();
      isRecording = false;
    }

    window.api.onSidecarStatus(({ status }) => {
      document.getElementById("status").textContent = status;
    });

    window.api.onTranscriptionRaw(({ text, language }) => {
      document.getElementById("output").innerHTML += `<p><strong>Raw (${language}):</strong> ${text}</p>`;
    });

    window.api.onPolishToken(({ token }) => {
      document.getElementById("output").innerHTML += token;
    });

    window.api.onPolishDone(() => {
      document.getElementById("output").innerHTML += "<p>[Polish complete]</p>";
    });

    window.api.onError(({ code, message }) => {
      document.getElementById("output").innerHTML += `<p style="color:red">[ERROR ${code}] ${message}</p>`;
    });
  </script>
</body>
</html>
```

### Running the PoC

**Prerequisites:**
```bash
# Terminal 1: Sidecar
cd cl_r1/sidecar && python server.py

# Terminal 2: Ollama
ollama serve

# Terminal 3: Swift recorder (build first)
cd cl_r1/swift-audio && swiftc main.swift -o recorder
```

**Run the PoC:**
```bash
cd /tmp/vd-poc
npx electron .
```

**Test sequence:**
1. Verify "Sidecar Status" shows "ready"
2. Click Record, speak something short, click Stop
3. Observe:
   - Raw transcript appears
   - Language badge shown
   - Polish tokens appear one at a time (not all at once)
   - No UI freezes
4. Open Activity Monitor, search "recorder":
   - Verify no orphan processes remain after stop
5. Repeat step 2 three times
6. Watch for any hangs, crashes, or token loss

**Acceptance Criteria:**
- ✓ Health polling works (status shows "ready")
- ✓ Record/stop spawns Swift binary, completes without hang
- ✓ Transcription returns in <3 seconds
- ✓ Polish tokens stream in (not all at once)
- ✓ No orphan recorder processes after stop
- ✓ Repeat 3x with no crashes or deadlocks
- ✓ IPC messages arrive in order (no scrambled tokens)

**Logging:**
After each cycle, record in `doc/validation-results.md`:
- Timestamp
- Audio input (what you said)
- Raw transcript (did Whisper get it right?)
- Polish output (did Qwen2.5 fix it?)
- Token count + timing
- Any errors or hangs
- Process cleanup (ps aux | grep recorder — should show nothing)

---

## Results Summary

After all three tests pass, fill in `doc/validation-results.md`:

```markdown
# Validation Results — March 26, 2026

## Test 1: Qwen2.5 Code-Switching
- **Result:** ✓ PASS (20/20)
- **Details:** All medical, engineering, CS, and general utterances preserved English terms perfectly

## Test 2: SSE Streaming
- **Result:** ✓ PASS
- **Latency:** 287ms to first token, 2.156s total for 47-token response
- **Streaming:** Incremental (not buffered)

## Test 3: IPC + Process Orchestration
- **Result:** ✓ PASS (3 cycles, no hangs/orphans)
- **Details:** Full end-to-end flow works cleanly

## Recommendation
All critical unknowns validated. Proceed to Phase 1 with confidence.
```

---

## Timeline

| Test | Est. Time | Blocker? |
|------|-----------|----------|
| Qwen2.5 code-switching | 1–2h | Yes — if fails, switch to Claude Haiku |
| SSE streaming | 1–2h | Maybe — if buffered, remove "streaming feels fast" feature |
| IPC PoC | 2–3h | Yes — if deadlocks, redesign architecture |
| **Total** | **5–7h** | — |

---

## Next Steps

1. **Run Test 1** → Log results
2. **Run Test 2** → Log results
3. **Run Test 3** → Log results
4. **All pass?** → Proceed to Phase 1 with full confidence
5. **Any fail?** → Document workaround + assess scope impact before starting Phase 1
