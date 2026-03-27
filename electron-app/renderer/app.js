// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const btnRecord = document.getElementById("btn-record");
const recordIcon = document.getElementById("record-icon");
const recordLabel = document.getElementById("record-label");
const statusText = document.getElementById("status-text");
const history = document.getElementById("history");
const historyToggle = document.getElementById("history-toggle");
const historyPanel = document.getElementById("history-panel");
const currentTranscript = document.getElementById("current-transcript");
const currentRaw = document.getElementById("current-raw");
const currentPolish = document.getElementById("current-polish");
const btnCopyCurrentRaw = document.getElementById("btn-copy-current-raw");
const btnCopyCurrentPolish = document.getElementById("btn-copy-current-polish");
const btnEditCurrentPolish = document.getElementById("btn-edit-current-polish");
const errorBanner = document.getElementById("error-banner");
const errorMessage = document.getElementById("error-message");
const btnDismissError = document.getElementById("btn-dismiss-error");
const vocabInput = document.getElementById("vocab-input");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let isRecording = false;
let sidecarReady = false;
let currentPolished = "";
let activeCard = null;       // the card currently being built
let activeRawEl = null;      // raw text element in active card
let activePolishEl = null;   // polished text element in active card
let activeLangBadge = null;
let activeCopyRawBtn = null;
let activeCopyPolishBtn = null;
let vocabMessageResetTimer = null;
const defaultVocabPlaceholder = vocabInput.placeholder;

function showVocabInputMessage(message, duration = 1500) {
  vocabInput.value = "";
  vocabInput.placeholder = message;
  if (vocabMessageResetTimer) clearTimeout(vocabMessageResetTimer);
  vocabMessageResetTimer = setTimeout(() => {
    if (vocabInput.placeholder === message) {
      vocabInput.placeholder = defaultVocabPlaceholder;
    }
    vocabMessageResetTimer = null;
  }, duration);
}

function syncHistoryEmptyState() {
  const hasCards = history.querySelector(".transcript-card");
  const existingEmpty = history.querySelector(".history-empty");

  // Check if there's data in localStorage (for initial load)
  let hasStoredHistory = false;
  try {
    const stored = JSON.parse(localStorage.getItem("vd_history") || "[]");
    hasStoredHistory = stored.length > 0;
  } catch (e) {}

  if (!hasCards && !hasStoredHistory && !existingEmpty) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "No history yet";
    empty.style.color = "#666";
    empty.style.fontSize = "12px";
    empty.style.padding = "8px";
    history.appendChild(empty);
  } else if ((hasCards || hasStoredHistory) && existingEmpty) {
    existingEmpty.remove();
  }
}

// ---------------------------------------------------------------------------
// Vocab management
// ---------------------------------------------------------------------------
const vocabPanel = document.getElementById("vocab-panel");
const vocabList = document.getElementById("vocab-list");
const vocabToggle = document.getElementById("vocab-toggle");

function loadVocab() {
  try {
    const stored = JSON.parse(localStorage.getItem("vd_vocab") || "{}");
    return stored.terms || [];
  } catch (e) {
    return [];
  }
}

function saveVocab(terms) {
  localStorage.setItem("vd_vocab", JSON.stringify({ terms }));
  renderVocabList();
}

function renderVocabList() {
  const terms = loadVocab();
  vocabList.innerHTML = "";

  if (terms.length === 0) {
    vocabList.innerHTML = '<div style="color: #666; font-size: 12px; padding: 8px;">No custom terms added yet</div>';
    return;
  }

  // Reverse order: newest first
  const reversedTerms = [...terms].reverse();
  reversedTerms.forEach((term) => {
    const item = document.createElement("div");
    item.className = "vocab-item";
    item.innerHTML = `
      <span class="vocab-item-text">${term}</span>
      <div class="vocab-item-actions">
        <button class="vocab-btn vocab-delete">Delete</button>
      </div>
    `;
    vocabList.appendChild(item);
  });
}

// Event delegation for vocab list
vocabList.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".vocab-delete");
  if (deleteBtn) {
    const termText = deleteBtn.closest(".vocab-item").querySelector(".vocab-item-text").textContent;
    const terms = loadVocab();
    const idx = terms.indexOf(termText);
    if (idx >= 0) {
      terms.splice(idx, 1);
      saveVocab(terms);
    }
  }
});

// Toggle vocab panel
vocabToggle.addEventListener("click", () => {
  vocabPanel.classList.toggle("hidden");
  const isHidden = vocabPanel.classList.contains("hidden");
  vocabToggle.textContent = isHidden
    ? "+ Show Custom Vocabulary"
    : "- Hide Custom Vocabulary";
  resizeWindow();
});

// Initialize toggle text
vocabToggle.textContent = "+ Show vocabulary";

// Add term on Enter (handle Korean input composition)
vocabInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.isComposing) {
    e.preventDefault();
    const term = vocabInput.value.trim();
    if (term) {
      const terms = loadVocab();
      if (!terms.includes(term)) {
        terms.push(term);
        saveVocab(terms);
        vocabInput.value = "";
      } else {
        showVocabInputMessage("Vocabulary already exists");
      }
    }
  }
});

// Load vocab on startup
renderVocabList();

// ---------------------------------------------------------------------------
// History toggle
// ---------------------------------------------------------------------------
function resizeWindow() {
  const historyHidden = historyPanel.classList.contains("hidden");
  const vocabHidden = vocabPanel.classList.contains("hidden");

  // Fixed width: record section + gap + transcript
  // Height: base (titlebar 38 + main 32 + top section 140 + toggles 64 + gaps 32) = 306px
  // + history panel height (200px when shown)
  // + vocab panel height (140px when shown)
  let height = 306; // Minimum with both panels hidden
  if (!historyHidden) height += 200;
  if (!vocabHidden) height += 140;

  window.api.resizeWindow(650, height);
}

historyToggle.addEventListener("click", () => {
  historyPanel.classList.toggle("hidden");
  const isHidden = historyPanel.classList.contains("hidden");
  historyToggle.textContent = isHidden
    ? "+ Show History"
    : "- Hide History";
  resizeWindow();
});

// Initialize toggle text
historyToggle.textContent = "+ Show history";

// ---------------------------------------------------------------------------
// Current transcript buttons
// ---------------------------------------------------------------------------
btnCopyCurrentRaw.addEventListener("click", () => {
  const text = currentRaw.textContent;
  if (text && text !== "Recording..." && text !== "Transcribing...") {
    window.api.copyToClipboard(text);
    btnCopyCurrentRaw.textContent = "Copied!";
    setTimeout(() => (btnCopyCurrentRaw.textContent = "Copy"), 1500);
  }
});

btnCopyCurrentPolish.addEventListener("click", () => {
  const text = currentPolish.textContent;
  if (text) {
    window.api.copyToClipboard(text);
    btnCopyCurrentPolish.textContent = "Copied!";
    setTimeout(() => (btnCopyCurrentPolish.textContent = "Copy"), 1500);
  }
});

btnEditCurrentPolish.addEventListener("click", () => {
  if (currentPolish.contentEditable === "true") {
    currentPolish.contentEditable = "false";
    btnEditCurrentPolish.textContent = "Edit";
  } else {
    currentPolish.contentEditable = "true";
    currentPolish.focus();
    btnEditCurrentPolish.textContent = "Done";
  }
});

// ---------------------------------------------------------------------------
// Sidecar status
// ---------------------------------------------------------------------------
window.api.onSidecarStatus(({ status }) => {
  sidecarReady = status === "ready";
  if (sidecarReady && !isRecording) {
    btnRecord.disabled = false;
    statusText.textContent = "Press Record or ⌘R";
  } else if (!sidecarReady && !isRecording) {
    statusText.textContent = status === "fatal" ? "Server\nfailed" : "Loading\nServer";
  }
  if (status === "fatal") {
    btnRecord.disabled = true;
  }
});

// ---------------------------------------------------------------------------
// Create a new transcript card
// ---------------------------------------------------------------------------
function createCard() {
  syncHistoryEmptyState();
  const card = document.createElement("div");
  card.className = "transcript-card";

  const now = new Date();
  const dateStr = now.toLocaleDateString([], { month: "2-digit", day: "2-digit" });
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fullTimeStr = `${dateStr} ${timeStr}`;

  card.innerHTML = `
    <div class="card-header">
      <span class="badge badge-hidden" data-lang></span>
      <span class="card-time">${fullTimeStr}</span>
      <button class="btn-delete-card">Delete</button>
    </div>
    <div class="transcript-section">
      <div class="transcript-header">
        <span>Raw</span>
        <button class="btn-copy" data-copy-raw>Copy</button>
      </div>
      <div class="transcript-text raw" data-raw></div>
    </div>
    <hr class="section-divider" />
    <div class="transcript-section">
      <div class="transcript-header">
        <span>Polished</span>
        <div style="display: flex; gap: 6px;">
          <button class="btn-copy" data-edit-polish>Edit</button>
          <button class="btn-copy" data-copy-polish>Copy</button>
        </div>
      </div>
      <div class="transcript-text" data-polish></div>
    </div>
  `;

  // Insert at top
  history.prepend(card);

  activeCard = card;
  activeRawEl = card.querySelector("[data-raw]");
  activePolishEl = card.querySelector("[data-polish]");
  activeLangBadge = card.querySelector("[data-lang]");
  activeCopyRawBtn = card.querySelector("[data-copy-raw]");
  activeCopyPolishBtn = card.querySelector("[data-copy-polish]");
  const activeEditPolishBtn = card.querySelector("[data-edit-polish]");

  // Copy raw — capture elements in closure so each card copies its own text
  const rawEl = activeRawEl;
  const rawBtn = activeCopyRawBtn;
  rawBtn.addEventListener("click", () => {
    const text = rawEl.textContent;
    if (text) {
      window.api.copyToClipboard(text);
      rawBtn.textContent = "Copied!";
      setTimeout(() => (rawBtn.textContent = "Copy"), 1500);
    }
  });

  // Copy polished — same closure pattern
  const polishEl = activePolishEl;
  const polishBtn = activeCopyPolishBtn;
  polishBtn.addEventListener("click", () => {
    const text = polishEl.textContent;
    if (text) {
      window.api.copyToClipboard(text);
      polishBtn.textContent = "Copied!";
      setTimeout(() => (polishBtn.textContent = "Copy"), 1500);
    }
  });

  // Edit polished text
  const editBtn = activeEditPolishBtn;
  editBtn.addEventListener("click", () => {
    if (polishEl.contentEditable === "true") {
      polishEl.contentEditable = "false";
      editBtn.textContent = "Edit";
      updateHistoryEntry(card, polishEl.textContent);
    } else {
      polishEl.contentEditable = "true";
      polishEl.focus();
      editBtn.textContent = "Done";
    }
  });

  // Delete card
  const deleteBtn = card.querySelector(".btn-delete-card");
  deleteBtn.addEventListener("click", () => {
    const rawText = activeRawEl?.textContent || "";
    card.remove();
    // Remove from localStorage history
    const key = "vd_history";
    let hist = [];
    try {
      hist = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {}
    hist = hist.filter(h => h.raw !== rawText);
    localStorage.setItem(key, JSON.stringify(hist));
    syncHistoryEmptyState();
  });

  return card;
}

// ---------------------------------------------------------------------------
// Recording status
// ---------------------------------------------------------------------------
window.api.onRecordingStatus(({ status }) => {
  if (status === "recording") {
    // Move previous transcript to history if it exists
    if (activeCard && !activeCard.parentElement) {
      // Card already in history, do nothing
    } else if (activeCard && activeCard.parentElement === history) {
      // Card is in history, do nothing
    } else if (currentRaw.textContent && currentRaw.textContent !== "Recording...") {
      // Move current transcript to history
      const card = createCard();
      activeRawEl.textContent = currentRaw.textContent;
      activePolishEl.textContent = currentPolish.textContent;
      activeCard = card;
    }

    isRecording = true;
    btnRecord.classList.add("recording");
    recordIcon.textContent = "■";
    recordLabel.textContent = "Stop";
    statusText.textContent = "Listening...";
    currentTranscript.classList.remove("hidden");
    currentRaw.textContent = "Recording...";
    currentPolish.textContent = "";
    currentPolished = "";
  }
  if (status === "transcribing") {
    statusText.textContent = "Transcribing...";
    btnRecord.disabled = true;
    if (activeRawEl) activeRawEl.textContent = "Transcribing...";
  }
  if (status === "polishing") {
    statusText.textContent = "Polishing...";
  }
});

// ---------------------------------------------------------------------------
// Transcription result
// ---------------------------------------------------------------------------
window.api.onTranscriptionResult(({ raw, language, confidence }) => {
  // Update current transcript
  currentRaw.textContent = raw;

  // Update card if it exists
  if (activeRawEl) activeRawEl.textContent = raw;

  // Language badge hidden from view, but stored for internal tracking
  if (activeLangBadge) {
    activeLangBadge.className = "badge badge-hidden";
  }

  currentPolished = "";
  currentPolish.innerHTML = '<span class="cursor"></span>';
  if (activePolishEl) activePolishEl.innerHTML = '<span class="cursor"></span>';
});

// ---------------------------------------------------------------------------
// Polish streaming
// ---------------------------------------------------------------------------
window.api.onPolishToken(({ token }) => {
  currentPolished += token;
  currentPolish.innerHTML = currentPolished + '<span class="cursor"></span>';
  if (activePolishEl) {
    activePolishEl.innerHTML = currentPolished + '<span class="cursor"></span>';
  }
});

window.api.onPolishDone(({ text }) => {
  currentPolished = text;
  currentPolish.textContent = text;
  if (activePolishEl) activePolishEl.textContent = text;

  isRecording = false;
  btnRecord.classList.remove("recording");
  recordIcon.textContent = "●";
  recordLabel.textContent = "Record";
  btnRecord.disabled = false;
  statusText.textContent = "Done — press Record or ⌘R";

  // Save current transcript to history
  saveToHistory(currentRaw.textContent, text, "");
});

// ---------------------------------------------------------------------------
// Record button + keyboard shortcut
// ---------------------------------------------------------------------------
btnRecord.addEventListener("click", toggleRecording);

document.addEventListener("keydown", (e) => {
  if (e.metaKey && e.key === "r") {
    e.preventDefault();
    toggleRecording();
  }
  if (e.metaKey && e.key === "c" && currentPolished && !window.getSelection().toString()) {
    e.preventDefault();
    window.api.copyToClipboard(currentPolished);
    if (activeCopyPolishBtn) {
      activeCopyPolishBtn.textContent = "Copied!";
      setTimeout(() => (activeCopyPolishBtn.textContent = "Copy"), 1500);
    }
  }
});

function toggleRecording() {
  if (btnRecord.disabled) return;

  if (!isRecording) {
    window.api.startRecording();
  } else {
    window.api.stopRecording();
    isRecording = false;
    btnRecord.classList.remove("recording");
    recordIcon.textContent = "●";
    recordLabel.textContent = "Record";
  }
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
window.api.onError(({ code, message }) => {
  console.error(`[Error] ${code}: ${message}`);
  errorMessage.textContent = `${code}: ${message}`;
  errorBanner.classList.remove("hidden");

  isRecording = false;
  btnRecord.classList.remove("recording");
  recordIcon.textContent = "●";
  recordLabel.textContent = "Record";
  if (sidecarReady) btnRecord.disabled = false;
  statusText.textContent = "Error — try again";
});

btnDismissError.addEventListener("click", () => {
  errorBanner.classList.add("hidden");
});

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------
function saveToHistory(raw, polished, language) {
  const key = "vd_history";
  let hist = [];
  try {
    hist = JSON.parse(localStorage.getItem(key) || "[]");
  } catch (e) {}

  hist.unshift({
    raw,
    polished,
    language,
    timestamp: Date.now(),
  });

  if (hist.length > 100) hist = hist.slice(0, 100);
  localStorage.setItem(key, JSON.stringify(hist));
}

function updateHistoryEntry(card, newPolished) {
  const rawEl = card.querySelector("[data-raw]");
  const rawText = rawEl?.textContent || "";

  const key = "vd_history";
  let hist = [];
  try {
    hist = JSON.parse(localStorage.getItem(key) || "[]");
  } catch (e) {}

  // Find entry by matching raw text
  const entry = hist.find(h => h.raw === rawText);
  if (entry) {
    entry.polished = newPolished;
    localStorage.setItem(key, JSON.stringify(hist));
  }
}

// Load history from localStorage on app startup
function loadHistoryFromStorage() {
  const key = "vd_history";
  let hist = [];
  try {
    hist = JSON.parse(localStorage.getItem(key) || "[]");
  } catch (e) {}

  // Render each stored history entry as a card
  hist.forEach(entry => {
    const card = document.createElement("div");
    card.className = "transcript-card";

    const timestamp = new Date(entry.timestamp);
    const dateStr = timestamp.toLocaleDateString([], { month: "2-digit", day: "2-digit" });
    const timeStr = timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const fullTimeStr = `${dateStr} ${timeStr}`;

    card.innerHTML = `
      <div class="card-header">
        <span class="badge badge-hidden" data-lang>${entry.language || ""}</span>
        <span class="card-time">${fullTimeStr}</span>
        <button class="btn-delete-card">Delete</button>
      </div>
      <div class="transcript-section">
        <div class="transcript-header">
          <span>Raw</span>
          <button class="btn-copy" data-copy-raw>Copy</button>
        </div>
        <div class="transcript-text raw" data-raw>${entry.raw}</div>
      </div>
      <hr class="section-divider" />
      <div class="transcript-section">
        <div class="transcript-header">
          <span>Polished</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn-copy" data-edit-polish>Edit</button>
            <button class="btn-copy" data-copy-polish>Copy</button>
          </div>
        </div>
        <div class="transcript-text" data-polish>${entry.polished}</div>
      </div>
    `;

    // Append to history panel
    history.appendChild(card);

    // Set up event listeners
    const rawEl = card.querySelector("[data-raw]");
    const rawBtn = card.querySelector("[data-copy-raw]");
    rawBtn.addEventListener("click", () => {
      const text = rawEl.textContent;
      if (text) {
        window.api.copyToClipboard(text);
        rawBtn.textContent = "Copied!";
        setTimeout(() => (rawBtn.textContent = "Copy"), 1500);
      }
    });

    const polishEl = card.querySelector("[data-polish]");
    const polishBtn = card.querySelector("[data-copy-polish]");
    polishBtn.addEventListener("click", () => {
      const text = polishEl.textContent;
      if (text) {
        window.api.copyToClipboard(text);
        polishBtn.textContent = "Copied!";
        setTimeout(() => (polishBtn.textContent = "Copy"), 1500);
      }
    });

    const editBtn = card.querySelector("[data-edit-polish]");
    editBtn.addEventListener("click", () => {
      if (polishEl.contentEditable === "true") {
        polishEl.contentEditable = "false";
        editBtn.textContent = "Edit";
        updateHistoryEntry(card, polishEl.textContent);
      } else {
        polishEl.contentEditable = "true";
        editBtn.textContent = "Done";
        polishEl.focus();
      }
    });

    const deleteBtn = card.querySelector(".btn-delete-card");
    deleteBtn.addEventListener("click", () => {
      card.remove();
      syncHistoryEmptyState();

      // Remove from localStorage
      const key = "vd_history";
      let hist = [];
      try {
        hist = JSON.parse(localStorage.getItem(key) || "[]");
      } catch (e) {}
      hist = hist.filter(h => h.raw !== rawEl.textContent);
      localStorage.setItem(key, JSON.stringify(hist));
    });
  });
}

// Initialize history empty state
syncHistoryEmptyState();
// Load history from localStorage
loadHistoryFromStorage();
V