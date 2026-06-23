#!/bin/bash
set -e

# ponytail: prefer the user's Homebrew Node; /usr/local Node 20.2 cannot run Vite 7.
if [ -x "$HOME/homebrew/bin/node" ]; then
  export PATH="$HOME/homebrew/bin:$PATH"
fi

echo "=== Harness Initialization ==="
echo "Project: Taipei Feitsui Reservoir Water Quality Map"
echo "Working directory: $(pwd)"
echo ""

echo "=== npm ci ==="
npm ci

echo "=== npm run convert:data ==="
npm run convert:data

echo "=== npm test ==="
npm test

echo "=== npm run build ==="
npm run build

echo "=== GITHUB_PAGES=true npm run build ==="
GITHUB_PAGES=true npm run build

echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "1. Read feature_list.json to see current feature state"
echo "2. Pick ONE unfinished feature to work on"
echo "3. Implement only that feature"
echo "4. Re-run verification before claiming done"
echo ""
echo "Note: npm run fetch:data is intentionally not part of init.sh because it performs network I/O and rewrites raw data resources."
