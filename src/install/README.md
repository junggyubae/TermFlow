# Voice Dictation Installer

One-command setup for macOS.

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/junggyubae/cl_r1
cd cl_r1

# 2. Run the installer
chmod +x src/install/install.sh
./src/install/install.sh
```

That's it! The installer will:
- ✅ Check that Python 3 and Node.js are installed
- ✅ Create Python venv and install dependencies
- ✅ Install Node.js dependencies
- ✅ Prompt for your Anthropic API key
- ✅ Launch the app

## What You Need

- **macOS** (Apple Silicon or Intel)
- **Python 3.9+** — Check: `python3 --version`
- **Node.js 18+** — Check: `node --version`
- **Anthropic API Key** — Get at https://console.anthropic.com/api-keys

## If Something Goes Wrong

**Python venv already exists:**
```bash
rm -rf src/sidecar/venv
./src/install/install.sh
```

**Node modules already exist:**
```bash
rm -rf src/electron-app/node_modules
./src/install/install.sh
```

**Port 5001 already in use:**
```bash
lsof -i :5001 | grep -v COMMAND | awk '{print $2}' | xargs kill -9
```

**Whisper model stuck downloading:**
```bash
rm -rf ~/.cache/huggingface/hub/models--Systran--faster-whisper-*
```

## Manual Setup (if you prefer)

See [../../../SETUP.md](../../../SETUP.md) for step-by-step instructions.
