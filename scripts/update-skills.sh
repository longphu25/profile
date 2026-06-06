#!/usr/bin/env bash
# Update all agent skills to latest versions
set -euo pipefail

echo "==> Updating Sui skills (mystenlabs/skills)..."
npx skills update -y

echo ""
echo "==> Installed skills:"
npx skills ls

echo ""
echo "Done. Commit skills-lock.json if versions changed."
