#!/usr/bin/env bash
# kp-skills setup: installs what the post renderer needs on this Mac.
#
#   bash setup.sh            install or repair (safe to run again)
#   bash setup.sh --check    only report what's missing
#
# What it does:
#   1. Makes sure Node.js 20+ is available (installs it with Homebrew if not).
#   2. Installs the pinned Playwright and its headless Chromium into
#      ~/.kp-skills/runtime (about 250 MB, downloaded once).
#   3. Creates the posts folder, ~/Pictures/KP Posts.
#   4. Runs the doctor check, which renders a test post offline.
#
# Nothing is installed globally except Node (via Homebrew), and nothing needs
# an administrator password.
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KP_HOME="${KP_HOME:-$HOME/.kp-skills}"
RUNTIME="${KP_RUNTIME:-$KP_HOME/runtime}"
CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

say()  { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
fail() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

# Homebrew lives in different places on Apple silicon and Intel Macs.
for brew in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  if [[ -x "$brew" ]] && ! command -v brew >/dev/null 2>&1; then eval "$("$brew" shellenv)"; fi
done

node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  local major
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [[ "$major" -ge 20 ]]
}

step "Checking Node.js"
if node_ok; then
  say "Node.js $(node --version) is ready."
elif [[ $CHECK_ONLY -eq 1 ]]; then
  fail "Node.js 20 or newer is missing. Run this script without --check to install it."
elif command -v brew >/dev/null 2>&1; then
  say "Installing Node.js with Homebrew (a few minutes)..."
  brew install node
  node_ok || fail "Node.js still isn't working after installing. Open a new Terminal window and run this again."
else
  fail "Node.js isn't installed and Homebrew wasn't found. Install Homebrew from https://brew.sh, then run this again."
fi

step "Installing the image renderer (Playwright $(node -p "require('$PLUGIN_ROOT/runtime/package.json').dependencies.playwright"))"
WANTED="$(node -p "require('$PLUGIN_ROOT/runtime/package.json').dependencies.playwright")"
HAVE="$(node -p "try{require('$RUNTIME/node_modules/playwright/package.json').version}catch(e){''}" 2>/dev/null || true)"
if [[ "$HAVE" == "$WANTED" && -d "$RUNTIME/browsers" && -n "$(ls -A "$RUNTIME/browsers" 2>/dev/null)" ]]; then
  say "Already installed in $RUNTIME."
elif [[ $CHECK_ONLY -eq 1 ]]; then
  fail "The renderer isn't installed (or is the wrong version). Run this script without --check."
else
  mkdir -p "$RUNTIME"
  cp "$PLUGIN_ROOT/runtime/package.json" "$PLUGIN_ROOT/runtime/package-lock.json" "$RUNTIME/"
  (cd "$RUNTIME" && npm ci --no-audit --no-fund --loglevel=error)
  say "Downloading the headless Chromium browser (once, about 100 MB)..."
  (cd "$RUNTIME" && PLAYWRIGHT_BROWSERS_PATH="$RUNTIME/browsers" npx --no-install playwright install --only-shell chromium)
  say "Installed in $RUNTIME."
fi

if [[ $CHECK_ONLY -eq 0 ]]; then
  step "Creating the posts folder"
  node "$PLUGIN_ROOT/scripts/kp.mjs" init
fi

step "Checking everything works (renders a test post)"
node "$PLUGIN_ROOT/scripts/doctor.mjs"
