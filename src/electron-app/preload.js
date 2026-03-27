const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Recording
  startRecording: () => ipcRenderer.send("start-recording"),
  stopRecording: () => ipcRenderer.send("stop-recording"),

  // Clipboard
  copyToClipboard: (text) => ipcRenderer.send("copy-to-clipboard", text),

  // Window sizing
  resizeWindow: (width, height) => ipcRenderer.send("resize-window", { width, height }),

  // Events from main
  onRecordingStatus: (fn) =>
    ipcRenderer.on("recording-status", (_, data) => fn(data)),
  onSidecarStatus: (fn) =>
    ipcRenderer.on("sidecar-status", (_, data) => fn(data)),
  onTranscriptionResult: (fn) =>
    ipcRenderer.on("streaming-transcribe", (_, data) => fn(data)),
  onTranscriptionComplete: (fn) =>
    ipcRenderer.on("transcription-complete", (_, data) => fn(data)),
  onPolishToken: (fn) =>
    ipcRenderer.on("polish-token", (_, data) => fn(data)),
  onPolishDone: (fn) =>
    ipcRenderer.on("polish-done", (_, data) => fn(data)),
  onModelDownloadProgress: (fn) =>
    ipcRenderer.on("model-download-progress", (_, data) => fn(data)),
  onError: (fn) =>
    ipcRenderer.on("error", (_, data) => fn(data)),
});
