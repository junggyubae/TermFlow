const { app, BrowserWindow, ipcMain, clipboard } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, "..");
const RECORDER_PATH = path.join(PROJECT_ROOT, "swift-audio", "recorder");
const SIDECAR_SCRIPT = path.join(PROJECT_ROOT, "sidecar", "server.py");
const VENV_PYTHON = path.join(PROJECT_ROOT, "venv", "bin", "python3");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let mainWindow = null;
let sidecarProcess = null;
let recorderProcess = null;
let healthInterval = null;
let sidecarRestarted = false;
let recorderStdout = "";

// ---------------------------------------------------------------------------
// Sidecar management
// ---------------------------------------------------------------------------
function startSidecar() {
  if (sidecarProcess) return;

  sidecarProcess = spawn(VENV_PYTHON, [SIDECAR_SCRIPT], {
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
  });

  sidecarProcess.stdout.on("data", (data) => {
    const line = data.toString().trim();
    console.log("[Sidecar]", line);

    const progressMatch = line.match(/PROGRESS:(\d+)/);
    if (progressMatch) {
      send("model-download-progress", { percent: parseInt(progressMatch[1]) });
    }
  });

  sidecarProcess.stderr.on("data", (data) => {
    console.error("[Sidecar ERR]", data.toString().trim());
  });

  sidecarProcess.on("close", (code) => {
    console.log("[Sidecar] exited with code", code);
    sidecarProcess = null;
  });
}

function stopSidecar() {
  if (sidecarProcess) {
    sidecarProcess.kill();
    sidecarProcess = null;
  }
}

// ---------------------------------------------------------------------------
// Health polling (every 500ms, 3 retries, 1 auto-restart)
// ---------------------------------------------------------------------------
let healthFailCount = 0;

function pollHealth() {
  const req = http.get("http://localhost:5001/health", { timeout: 400 }, (res) => {
    if (res.statusCode === 200) {
      healthFailCount = 0;
      send("sidecar-status", { status: "ready" });
    } else {
      handleHealthFail();
    }
  });
  req.on("error", () => handleHealthFail());
  req.on("timeout", () => {
    req.destroy();
    handleHealthFail();
  });
}

function handleHealthFail() {
  healthFailCount++;
  if (healthFailCount >= 3) {
    if (!sidecarRestarted) {
      console.log("[Main] Health failed 3x, auto-restarting sidecar...");
      sidecarRestarted = true;
      stopSidecar();
      startSidecar();
      healthFailCount = 0;
      send("sidecar-status", { status: "restarting" });
    } else {
      send("sidecar-status", { status: "fatal" });
    }
  } else {
    send("sidecar-status", { status: "error" });
  }
}

// ---------------------------------------------------------------------------
// IPC helpers
// ---------------------------------------------------------------------------
function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function postJSON(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "localhost",
        port: 5001,
        path: urlPath,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (c) => (chunks += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(chunks));
          } catch (e) {
            reject(new Error(`Invalid JSON from sidecar: ${chunks}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function streamPolish(text, vocab, finalRaw = null, language = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ text, vocab });
    const req = http.request(
      {
        hostname: "localhost",
        port: 5001,
        path: "/polish",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let buffer = "";
        let fullText = "";

        res.on("data", (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const payload = line.slice(6);
              if (payload === "[DONE]") {
                // Include final raw text if available
                const result = { text: fullText };
                if (finalRaw) result.raw = finalRaw;
                if (language) result.language = language;
                send("polish-done", result);
                resolve(fullText);
              } else {
                try {
                  const parsed = JSON.parse(payload);
                  if (parsed.token) {
                    fullText += parsed.token;
                    send("polish-token", { token: parsed.token });
                  }
                  if (parsed.error) {
                    send("error", { code: "POLISH_FAILED", message: parsed.error });
                    reject(new Error(parsed.error));
                  }
                } catch (e) {
                  // skip malformed lines
                }
              }
            }
          }
        });

        res.on("error", reject);
      }
    );
    req.on("error", (err) => {
      send("error", { code: "POLISH_FAILED", message: err.message });
      reject(err);
    });
    req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Recording IPC
// ---------------------------------------------------------------------------
let streamingFilePath = null;
let streamingInterval = null;

ipcMain.on("start-recording", () => {
  if (recorderProcess) {
    console.log("[Main] Recorder already running");
    return;
  }

  console.log("[Main] Starting recorder from:", RECORDER_PATH);
  recorderStdout = "";
  streamingFilePath = null;

  try {
    recorderProcess = spawn(RECORDER_PATH, [], { stdio: ["pipe", "pipe", "pipe"] });
    console.log("[Main] Recorder spawned, PID:", recorderProcess.pid);
  } catch (err) {
    console.error("[Main] Failed to spawn recorder:", err.message);
    send("error", { code: "RECORDER_SPAWN_FAILED", message: err.message });
    recorderProcess = null;
    return;
  }

  recorderProcess.stdout.on("data", (data) => {
    const text = data.toString();
    console.log("[Recorder stdout]", text);
    recorderStdout += text;
  });

  recorderProcess.stderr.on("data", (data) => {
    const line = data.toString().trim();
    console.log("[Recorder stderr]", line);

    // Capture file path for streaming
    if (line.startsWith("FILE_PATH:")) {
      streamingFilePath = line.slice("FILE_PATH:".length);
      console.log("[Main] Streaming file:", streamingFilePath);

      // Start periodic streaming transcription
      startStreamingTranscription();
    }

    if (line.startsWith("RECORDING")) {
      console.log("[Main] Recording started");
      send("recording-status", { status: "recording" });
    }
  });

  recorderProcess.on("error", (err) => {
    console.error("[Recorder] spawn error:", err.message);
    send("error", { code: "MIC_DENIED", message: err.message });
    recorderProcess = null;
  });

  recorderProcess.on("close", (code) => {
    console.log("[Recorder] closed with code:", code);
  });
});

function startStreamingTranscription() {
  // Get vocab once
  mainWindow.webContents.executeJavaScript(
    `(() => { try { return JSON.parse(localStorage.getItem("vd_vocab") || "{}").terms || []; } catch(e) { return []; } })()`
  ).then((vocab) => {
    // Poll every 500ms to transcribe partial audio
    streamingInterval = setInterval(async () => {
      if (!streamingFilePath || !fs.existsSync(streamingFilePath)) {
        return;
      }

      try {
        const result = await postJSON("/streaming-transcribe", { path: streamingFilePath, vocab });
        if (result.raw) {
          send("streaming-transcription", { raw: result.raw });
        }
      } catch (err) {
        console.log("[Main] Streaming transcription (non-fatal):", err.message);
      }
    }, 500);
  }).catch(() => {
    console.log("[Main] Could not get vocab for streaming");
  });
}

ipcMain.on("stop-recording", () => {
  if (!recorderProcess) {
    send("error", { code: "EMPTY_AUDIO", message: "No active recording" });
    return;
  }

  // Stop streaming
  if (streamingInterval) {
    clearInterval(streamingInterval);
    streamingInterval = null;
  }

  recorderProcess.stdin.write("stop\n");
  send("recording-status", { status: "transcribing" });

  recorderProcess.on("close", async (code) => {
    recorderProcess = null;
    const wavPath = recorderStdout.trim();
    console.log("[Main] Recorder exited code:", code, "wavPath:", wavPath);

    if (!wavPath || !fs.existsSync(wavPath)) {
      send("error", { code: "EMPTY_AUDIO", message: "No audio file produced" });
      return;
    }

    try {
      // Read vocab from localStorage via renderer, fallback to empty
      const vocab = await new Promise((res) => {
        mainWindow.webContents.executeJavaScript(
          `(() => { try { return JSON.parse(localStorage.getItem("vd_vocab") || "{}").terms || []; } catch(e) { return []; } })()`
        ).then(res).catch(() => res([]));
      });

      // Get FINAL transcription with full accuracy (beam_size=5)
      const result = await postJSON("/transcribe", { path: wavPath, vocab, beam_size: 5 });

      // Delete audio immediately (privacy)
      fs.unlink(wavPath, () => {});

      if (result.error) {
        send("error", { code: "TRANSCRIBE_FAILED", message: result.error });
        return;
      }

      // DO NOT send transcription result to UI
      // (final raw is fed directly to polish, never displayed)
      // Store final raw and language for history saving
      const finalRaw = result.raw;
      const finalLanguage = result.language;

      // Polish using FINAL raw text
      send("recording-status", { status: "polishing" });
      await streamPolish(finalRaw, vocab, finalRaw, finalLanguage);
    } catch (err) {
      console.error("[Main] Pipeline error:", err.message);
      send("error", { code: "TRANSCRIBE_FAILED", message: err.message });
    }
  });
});

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------
ipcMain.on("copy-to-clipboard", (_, text) => {
  clipboard.writeText(text);
});

// ---------------------------------------------------------------------------
// Window sizing
// ---------------------------------------------------------------------------
ipcMain.on("resize-window", (_, { width, height }) => {
  if (mainWindow) {
    mainWindow.setSize(width, height);
  }
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 650,
    height: 306,
    minWidth: 650,
    maxWidth: 650,
    minHeight: 306,
    resizable: false,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  startSidecar();
  healthInterval = setInterval(pollHealth, 500);
});

app.on("window-all-closed", () => {
  clearInterval(healthInterval);
  stopSidecar();
  if (recorderProcess) recorderProcess.kill();
  app.quit();
});
