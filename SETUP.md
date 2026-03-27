# Setup Instructions

## Prerequisites
- **macOS** (Apple Silicon or Intel)
- **Anthropic API Key** (get at https://console.anthropic.com/)

## Quick Start (Packaged App)

### 1. Get Your API Key
1. Go to https://console.anthropic.com/
2. Click **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-`)

### 2. Build the App
```bash
# Set up Python sidecar
cd src/sidecar
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..

# Build the Electron app
cd src/electron-app
npm install
npm run dist
cd ../..
```

### 3. Run the App
```bash
export ANTHROPIC_API_KEY="sk-ant-YOUR_KEY_HERE"
export WHISPER_MODEL=medium
open src/electron-app/dist/mac-arm64/Voice\ Dictation.app
```

Or copy to Applications folder:
```bash
cp -r src/electron-app/dist/mac-arm64/Voice\ Dictation.app /Applications/
open /Applications/Voice\ Dictation.app
```

---

## Development Setup (Optional)

If you want to run from source instead of the packaged app:

### Prerequisites for Development
- Node.js (v18+)
- Python 3.9+

### 1. Install Node Dependencies
```bash
cd src/electron-app
npm install
```

### 2. Install Python Sidecar Dependencies
```bash
cd src/sidecar
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Run in Development Mode
```bash
cd src/electron-app

# Set environment variables
export ANTHROPIC_API_KEY="sk-ant-YOUR_KEY_HERE"
export WHISPER_MODEL=medium

# Start the app
npx electron .
```

### 4. Build New Package (if modified)
```bash
cd src/electron-app
npm run dist
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
