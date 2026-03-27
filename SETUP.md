# Setup Instructions

## Prerequisites
- **macOS** (Apple Silicon or Intel)
- **Node.js** (v18+)
- **Python 3.9+**
- **Anthropic API Key** (get at https://console.anthropic.com/)

## Quick Start

### 1. Get Your API Key
1. Go to https://console.anthropic.com/
2. Click **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-`)

### 2. Install Dependencies
```bash
# Python sidecar
cd src/sidecar
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..

# Electron app
cd src/electron-app
npm install
cd ../..
```

### 3. Run the App
```bash
cd src/electron-app
export ANTHROPIC_API_KEY="sk-ant-YOUR_KEY_HERE"
export WHISPER_MODEL=medium
npx electron .
```

---

## Build Packaged App (Optional)

To distribute as a standalone `.app`:

```bash
cd src/electron-app
npm run dist
cp -r dist/mac-arm64/Voice\ Dictation.app /Applications/
open /Applications/Voice\ Dictation.app
```

**Whisper Model Options:**
- `tiny` - Fastest, lowest quality
- `base` - Fast, reasonable quality
- `small` - Good balance
- `medium` - Better quality, slower
- `large` - Best quality, slowest

**Keyboard Shortcuts:**
- `⌘R` - Start/stop recording
- `⌘C` - Copy polished transcript

## Features
- **Live transcription** with Korean + English code-switching
- **Auto-polishing** using Claude AI
- **Custom vocabulary** for technical terms
- **Transcript history** with edit capability
- **Dark theme** optimized for macOS

## Troubleshooting

### "Port 5001 already in use"
Kill the existing sidecar process:
```bash
lsof -i :5001 | grep -v COMMAND | awk '{print $2}' | xargs kill -9
```

### Whisper model stuck downloading
Models are cached in `~/.cache/huggingface/`. Delete the model folder and restart:
```bash
rm -rf ~/.cache/huggingface/hub/models--Systran--faster-whisper-*
```

### No microphone permission
Grant microphone access in System Preferences > Security & Privacy > Microphone

## Architecture

- **src/electron-app/** - Desktop UI (Electron)
- **src/sidecar/** - Backend server (Flask + Whisper + Claude API)
- **src/swift-audio/** - macOS audio recorder (Swift)
- **doc/** - Documentation and validation logs
