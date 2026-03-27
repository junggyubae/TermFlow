# Setup Instructions

## Prerequisites
- Node.js (v18+)
- Python 3.9+
- macOS (currently macOS-only for the Swift audio recorder)

## Installation

### 1. Install Node Dependencies
```bash
cd electron-app
npm install
```

### 2. Install Python Sidecar Dependencies
```bash
cd sidecar
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Download Whisper Models
The app uses OpenAI's Whisper for speech-to-text. Models are downloaded automatically on first use.

**Whisper Model Options:**
- `tiny` - Fastest, lowest quality
- `base` - Fast, reasonable quality
- `small` - Good balance (default)
- `medium` - Better quality, slower
- `large` - Best quality, slowest

Set model via environment variable:
```bash
export WHISPER_MODEL=medium
```

### 4. Build Swift Audio Recorder (if needed)
```bash
cd swift-audio
swiftc -O main.swift -o recorder
```

## Running the App

```bash
cd electron-app

# Set required environment variables
export ANTHROPIC_API_KEY="your-api-key-here"
export WHISPER_MODEL=medium

# Start the app
npx electron .
```

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

- **electron-app/** - Desktop UI (Electron)
- **sidecar/** - Backend server (Flask + Whisper + Claude API)
- **swift-audio/** - macOS audio recorder (Swift)
- **doc/** - Documentation and validation logs
