#!/usr/bin/env bash
# Clone tt-a1i/archify once, then symlink its skill subfolder into all agent dirs.
# Run after cloning the repo: bash scripts/setup-agent-mirrors.sh
set -euo pipefail

REPO="https://github.com/tt-a1i/archify.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$ROOT/.archify-src"

# 1. Clone or update the single source
if [ -d "$CACHE/.git" ]; then
  echo "==> Updating archify source..."
  git -C "$CACHE" pull --ff-only 2>/dev/null || echo "    (pull failed, using existing)"
else
  echo "==> Cloning archify source..."
  rm -rf "$CACHE"
  git clone --depth 1 "$REPO" "$CACHE"
fi

# 2. Determine skill source (repo has archify/ subfolder with the skill)
SKILL_SRC="$CACHE/archify"
if [ ! -d "$SKILL_SRC" ]; then
  # Fallback: repo root IS the skill
  SKILL_SRC="$CACHE"
fi

# 3. Create symlinks for each agent directory
TARGETS=(".agents/skills/archify" ".claude/skills/archify" ".windsurf/skills/archify" ".factory/skills/archify")

for target in "${TARGETS[@]}"; do
  dest="$ROOT/$target"
  parent="$(dirname "$dest")"

  # Remove existing (file, symlink, or dir)
  rm -rf "$dest"
  mkdir -p "$parent"

  # Compute relative path from target parent to SKILL_SRC
  rel=$(python3 -c "import os.path; print(os.path.relpath('$SKILL_SRC', '$parent'))")
  ln -s "$rel" "$dest"
  echo "  $target -> $rel"
done

echo ""
echo "Done. All 4 mirrors point to .archify-src/archify/"
