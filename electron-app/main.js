const { app, BrowserWindow, ipcMain, clipboard } = require("electron");
const { spawn, execSync, execFile } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const IS_PACKAGED = app.isPackaged;
const RESOURCES_PATH = IS_PACKAGED ? process.resourcesPath : path.resolve(__dirname, "..");
const SIDECAR_DIR = path.join(RESOURCES_PATH, "sidecar");
const SIDECAR_SCRIPT = path.join(SIDECAR_DIR, "server.py");
const VENV_PYTHON = path.join(SIDECAR_DIR, "venv", "bin", "python3");
const RECORDER_PATH = IS_PACKAGED
  ? path.join(process.resourcesPath, "recorder")
  : path.join(RESOURCES_PATH, "swift-audio", "recorder");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let mainWindow = null;
let sidecarProcess = null;
let recorderProcess = null;
let healthInterval = null;
let sidecarRestarted = false;
let recorderStdout = "";
let recorderRawPath = "";
let partialTranscribeInterval = null;
let partialTranscribeInFlight = false;
let latestPartialRaw = "";
const SIDECAR_PORT = 5001;

// ---------------------------------------------------------------------------
// Sidecar management
// ---------------------------------------------------------------------------
function startSidecar() {
  if (sidecarProcess) return;

  killProcessOnPort(SIDECAR_PORT);

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

function killProcessOnPort(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" }).trim();
    if (!output) return;

    const pids = output
      .split("\n")
      .map((pid) => pid.trim())
      .filter((pid) => pid && Number.isInteger(Number(pid)));

    for (const pidStr of pids) {
      const pid = Number(pidStr);
      if (pid === process.pid) continue;
      try {
        process.kill(pid, "SIGKILL");
        console.log(`[Main] Killed PID ${pid} on port ${port}`);
      } catch (err) {
        console.log(`[Main] Failed killing PID ${pid} on port ${port}: ${err.message}`);
      }
    }
  } catch {
    // No process is bound to the port.
  }
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
  const req = http.get(`http://localhost:${SIDECAR_PORT}/health`, { timeout: 400 }, (res) => {
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
        port: SIDECAR_PORT,
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

function startPartialTranscribeLoop(vocab) {
  stopPartialTranscribeLoop();
  partialTranscribeInterval = setInterval(async () => {
    if (partialTranscribeInFlight || !recorderRawPath || !fs.existsSync(recorderRawPath)) {
      return;
    }
    partialTranscribeInFlight = true;
    let snapshotWavPath = "";
    try {
      snapshotWavPath = path.join(
        os.tmpdir(),
        `vd_partial_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`
      );
      await new Promise((resolve, reject) => {
        execFile(
          "/usr/bin/afconvert",
          [recorderRawPath, snapshotWavPath, "-d", "LEI16", "-f", "WAVE", "-r", "16000", "-c", "1"],
          (err) => (err ? reject(err) : resolve())
        );
      });
      const partial = await postJSON("/transcribe", {
        path: snapshotWavPath,
        vocab,
        beam_size: 1,
        model_size: "tiny",
        is_partial: true,
      });
      if (partial?.raw && partial.raw !== latestPartialRaw) {
        latestPartialRaw = partial.raw;
        send("streaming-transcribe", { raw: partial.raw });
      }
    } catch {
      // Ignore transient chunk transcription errors while recording.
    } finally {
      if (snapshotWavPath) fs.unlink(snapshotWavPath, () => {});
      partialTranscribeInFlight = false;
    }
  }, 150);
}

function stopPartialTranscribeLoop() {
  if (partialTranscribeInterval) {
    clearInterval(partialTranscribeInterval);
    partialTranscribeInterval = null;
  }
  partialTranscribeInFlight = false;
}

function streamPolish(text, vocab) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ text, vocab });
    const req = http.request(
      {
        hostname: "localhost",
        port: SIDECAR_PORT,
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
                send("polish-done", { text: fullText });
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
ipcMain.on("start-recording", () => {
  if (recorderProcess) return;

  recorderStdout = "";
  recorderRawPath = "";
  latestPartialRaw = "";
  recorderProcess = spawn(RECORDER_PATH, [], { stdio: ["pipe", "pipe", "pipe"] });

  const vocabPromise = new Promise((res) => {
    mainWindow.webContents.executeJavaScript(
      `(() => { try { return JSON.parse(localStorage.getItem("vd_vocab") || "{}").terms || []; } catch(e) { return []; } })()`
    ).then(res).catch(() => res([]));
  });

  recorderProcess.stdout.on("data", (data) => {
    recorderStdout += data.toString();
  });

  recorderProcess.stderr.on("data", (data) => {
    const lines = data.toString().split("\n").map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      console.log("[Recorder]", line);
      if (line.startsWith("RAW_PATH:")) {
        recorderRawPath = line.slice("RAW_PATH:".length).trim();
        vocabPromise.then((vocab) => startPartialTranscribeLoop(vocab));
      }
      if (line.startsWith("RECORDING")) {
        send("recording-status", { status: "recording" });
      }
    }
  });

  recorderProcess.on("error", (err) => {
    console.error("[Recorder] spawn error:", err.message);
    send("error", { code: "MIC_DENIED", message: err.message });
    recorderProcess = null;
  });
});

ipcMain.on("stop-recording", () => {
  if (!recorderProcess) {
    send("error", { code: "EMPTY_AUDIO", message: "No active recording" });
    return;
  }

  recorderProcess.stdin.write("stop\n");
  stopPartialTranscribeLoop();
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
      // TODO: Phase 4 Step 8 will add proper vocab UI
      const vocab = await new Promise((res) => {
        mainWindow.webContents.executeJavaScript(
          `(() => { try { return JSON.parse(localStorage.getItem("vd_vocab") || "{}").terms || []; } catch(e) { return []; } })()`
        ).then(res).catch(() => res([]));
      });
      const result = await postJSON("/transcribe", { path: wavPath, vocab });

      // Delete audio immediately (privacy)
      fs.unlink(wavPath, () => {});

      if (result.error) {
        send("error", { code: "TRANSCRIBE_FAILED", message: result.error });
        return;
      }

      send("transcription-complete", { raw: result.raw });

      // Polish
      send("recording-status", { status: "polishing" });
      await streamPolish(result.raw, vocab);
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
  stopPartialTranscribeLoop();
  stopSidecar();
  if (recorderProcess) recorderProcess.kill();
  app.quit();
});

app.on("will-quit", () => {
  // Force-kill anything still holding port 5001 (e.g. Flask child threads)
  killProcessOnPort(SIDECAR_PORT);
});
