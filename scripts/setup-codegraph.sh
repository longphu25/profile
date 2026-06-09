#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${CODEGRAPH_TARGET:-auto}"
LOCATION="${CODEGRAPH_LOCATION:-global}"
INSTALL_CLI="${CODEGRAPH_INSTALL_CLI:-0}"
RUN_AGENT_INSTALL=1
RUN_INDEX=1
YES=1

usage() {
  cat <<'EOF'
Setup CodeGraph for this repository.

Usage:
  bash scripts/setup-codegraph.sh [options]

Options:
  --install-cli          Install CodeGraph CLI if it is missing.
  --target=<targets>     Agent targets for `codegraph install`.
                         Examples: auto, all, codex,kiro,cursor,claude.
                         Default: auto.
  --location=<scope>     CodeGraph config location: global or local.
                         Default: global.
  --no-agent-install     Skip `codegraph install`.
  --no-index             Skip `codegraph init -i`.
  --prompt               Do not pass --yes to `codegraph install`.
  -h, --help             Show this help.

Environment:
  CODEGRAPH_TARGET       Same as --target.
  CODEGRAPH_LOCATION     Same as --location.
  CODEGRAPH_INSTALL_CLI  Set to 1 to install CLI if missing.

Examples:
  bash scripts/setup-codegraph.sh --install-cli --target=codex,kiro
  CODEGRAPH_TARGET=auto bun run setup:codegraph
EOF
}

for arg in "$@"; do
  case "$arg" in
    --install-cli)
      INSTALL_CLI=1
      ;;
    --target=*)
      TARGET="${arg#*=}"
      ;;
    --location=*)
      LOCATION="${arg#*=}"
      ;;
    --no-agent-install)
      RUN_AGENT_INSTALL=0
      ;;
    --no-index)
      RUN_INDEX=0
      ;;
    --prompt)
      YES=0
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$LOCATION" in
  global|local) ;;
  *)
    echo "Invalid --location value: $LOCATION. Use global or local." >&2
    exit 2
    ;;
esac

cd "$ROOT_DIR"

has_command() {
  command -v "$1" >/dev/null 2>&1
}

install_cli() {
  if has_command npm; then
    echo "Installing CodeGraph CLI with npm..."
    npm i -g @colbymchenry/codegraph
    return
  fi

  if has_command curl; then
    echo "Installing CodeGraph CLI with the upstream install script..."
    curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
    return
  fi

  echo "Cannot install CodeGraph CLI: npm and curl are both unavailable." >&2
  exit 1
}

if ! has_command codegraph; then
  if [[ "$INSTALL_CLI" == "1" ]]; then
    install_cli
  else
    cat >&2 <<'EOF'
CodeGraph CLI is not available on PATH.

Install it first, then re-run this script:
  npm i -g @colbymchenry/codegraph

Or let this script install it:
  bash scripts/setup-codegraph.sh --install-cli
EOF
    exit 1
  fi
fi

echo "CodeGraph CLI:"
codegraph --version || true

if [[ "$RUN_AGENT_INSTALL" == "1" ]]; then
  install_args=(install "--target=${TARGET}" "--location=${LOCATION}")
  if [[ "$YES" == "1" ]]; then
    install_args+=(--yes)
  fi

  echo "Configuring CodeGraph MCP for agents: target=${TARGET}, location=${LOCATION}"
  codegraph "${install_args[@]}"
else
  echo "Skipping agent install."
fi

if [[ "$RUN_INDEX" == "1" ]]; then
  echo "Initializing and indexing this repository..."
  codegraph init -i
else
  echo "Skipping project index."
fi

echo "CodeGraph status:"
codegraph status || true

cat <<'EOF'

Done.
Restart Codex, Kiro, Cursor, Claude Code, or other configured agents so the
CodeGraph MCP server is loaded.
EOF
