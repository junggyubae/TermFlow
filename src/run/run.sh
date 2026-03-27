#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
  echo -e "${GREEN}==>${NC} $1"
}

print_error() {
  echo -e "${RED}Error:${NC} $1" >&2
}

print_warning() {
  echo -e "${YELLOW}Warning:${NC} $1"
}

# Check prerequisites
check_prerequisites() {
  print_header "Checking prerequisites..."

  if ! command -v python3 &> /dev/null; then
    print_error "Python 3 not found. Please install Python 3.9 or higher."
    exit 1
  fi

  if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js v18 or higher."
    exit 1
  fi

  echo "✓ Python 3: $(python3 --version)"
  echo "✓ Node.js: $(node --version)"
  echo "✓ npm: $(npm --version)"
}

# Install Python dependencies
install_python() {
  print_header "Setting up Python environment..."

  cd sidecar

  if [ -d "venv" ]; then
    print_warning "venv already exists. Skipping creation."
  else
    python3 -m venv venv
    echo "✓ venv created"
  fi

  # Activate venv and install
  source venv/bin/activate
  pip install -q -r requirements.txt
  deactivate

  echo "✓ Python dependencies installed"
  cd ..
}

# Install Node dependencies
install_node() {
  print_header "Installing Node dependencies..."

  cd electron-app

  if [ -d "node_modules" ]; then
    print_warning "node_modules already exists. Running npm install to update..."
  fi

  npm install -q

  echo "✓ Node dependencies installed"
  cd ..
}

# Get API key if not set
get_api_key() {
  # Priority: env var > saved file > prompt
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    CONFIG_DIR="$HOME/.config/voice-dictation"
    API_KEY_FILE="$CONFIG_DIR/api-key"

    # Check if saved API key exists
    if [ -f "$API_KEY_FILE" ]; then
      export ANTHROPIC_API_KEY=$(cat "$API_KEY_FILE")
      echo "✓ Using saved API key"
    else
      # Prompt for new API key
      print_header "Anthropic API Key required"
      echo "Get your API key at: https://console.anthropic.com/api-keys"
      echo ""
      read -p "Enter your API key (sk-ant-...): " api_key

      if [ -z "$api_key" ]; then
        print_error "API key cannot be empty"
        exit 1
      fi

      export ANTHROPIC_API_KEY="$api_key"

      # Save for future use
      mkdir -p "$CONFIG_DIR"
      echo "$api_key" > "$API_KEY_FILE"
      chmod 600 "$API_KEY_FILE"
      echo "✓ API key saved to $API_KEY_FILE"
    fi
  fi
}

# Run the app
run_app() {
  print_header "Starting Voice Dictation..."
  echo ""
  echo "Keyboard shortcuts:"
  echo "  ⌘R - Start/stop recording"
  echo "  ⌘C - Copy polished transcript"
  echo ""

  cd electron-app
  npx electron .
}

# Main
main() {
  echo -e "${GREEN}"
  echo "╔════════════════════════════════════════╗"
  echo "║       Voice Dictation Launcher         ║"
  echo "╚════════════════════════════════════════╝"
  echo -e "${NC}"

  # Get directory of this script
  SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
  PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

  # Change to src directory
  cd "$PROJECT_ROOT/src"

  check_prerequisites
  echo ""

  install_python
  echo ""

  install_node
  echo ""

  get_api_key
  echo ""

  run_app
}

# Run main
main "$@"
