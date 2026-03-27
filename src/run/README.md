# TermFlow Launcher

One-command setup and launch for macOS.

## Quick Start (First Time)

```bash
# 1. Clone the repository
git clone https://github.com/junggyubae/cl_r1
cd cl_r1

# 2. Run the launcher
chmod +x src/run/run.sh
./src/run/run.sh
```

The launcher will:
- ✅ Check that Python 3 and Node.js are installed
- ✅ Create Python venv and install dependencies
- ✅ Install Node.js dependencies
- ✅ Prompt for your Anthropic API key
- ✅ Launch the app

## Relaunch Later

After the first run, just use:

```bash
./src/run/run.sh
```

The launcher will:
- Skip setup (venv, node_modules already installed)
- Reuse your saved API key automatically
- Launch the app directly

**No re-entry needed.** Your API key is saved to `~/.config/termflow/api-key` after first launch.

To use a different API key, either:
- `export ANTHROPIC_API_KEY="sk-ant-..."` before running
- Or delete `~/.config/termflow/api-key` to be prompted again

## What You Need

- **macOS** (Apple Silicon or Intel)
- **Python 3.9+** — Check: `python3 --version`
- **Node.js 18+** — Check: `node --version`
- **Anthropic API Key** — Get at https://console.anthropic.com/api-keys

## If Something Goes Wrong

**Python venv already exists:**
```bash
rm -rf src/sidecar/venv
./src/run/run.sh
```

**Node modules already exist:**
```bash
rm -rf src/electron-app/node_modules
./src/run/run.sh
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
