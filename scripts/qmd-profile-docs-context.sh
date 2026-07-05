#!/usr/bin/env bash
# Re-apply QMD folder contexts for profile-docs after qmd update or fresh index.
# Contexts live in ~/.cache/qmd/index.sqlite (not in git).

set -euo pipefail

ROOT="qmd://profile-docs"

add() {
  local path="$1"
  local text="$2"
  qmd context rm "${ROOT}${path}" 2>/dev/null || true
  qmd context add "${ROOT}${path}" "$text"
}

add "/" \
  "Profile repo docs harness (docs/): product contracts, stories/plans, decisions ADR, domain folders btc-chart/, telegram/, deepbook/, defi/navi/, seal/, walrus/, zklogin/. Bilingual *.md + *.vi.md. Index: INDEX.md. Search: qmd search -c profile-docs."

add "/telegram/" \
  "Telegram BTC Chart Alert: DEPLOY.md (bot + GitHub Pages), TECHNICAL.md, auto-login initData, bot.mjs, Convex /telegram/auth, Turso, ROADMAP. ADR: telegram-data-backend. Story: plans/24-telegram-btc-alert.md."

add "/btc-chart/" \
  "BTC Chart Pro plugin: Lux NWE, ML signal, Trade Setup confluence, SMC WASM, multi-exchange, Turso coins. See TECHNICAL.md, trade-setup.md, ml-signal.md."

add "/agents/" \
  "Agent tooling docs: Open Design + Grok local UI workflow, Grok VPS GitHub automation, Cursor IDE, MCP setup."

add "/agents/open-design-grok/" \
  "Open Design desktop + Grok Build adapter: WORKFLOW setup, design systems, DESIGN.md, profile UI surfaces (telegram-btc-alert, plugins components). Not production dependency. Cross-link grok-vps-github for headless VPS."

add "/decisions/" \
  "Architecture decision records (ADR): durable tradeoffs. Includes telegram-data-backend, btc-chart-exchange-backend."

add "/stories/" \
  "Story packets and plans under stories/plans/. STATUS.md tracks state. Plan 24: telegram-btc-alert."

echo "profile-docs contexts:"
qmd context list | sed -n '/^profile-docs/,/^$/p' || qmd context list