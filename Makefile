.PHONY: dev build preview lint format format-check typecheck check audit clean help

# ─── Development ───
dev: ## Start dev server
	bun run dev

build: ## Type-check then production build
	bun run build

preview: ## Preview production build
	bun run preview

# ─── Code Quality ───
lint: ## Run ESLint
	bun run lint

format: ## Format code with Biome
	bun run format

format-check: ## Check formatting without writing
	bun run format:check

typecheck: ## Run TypeScript type checking
	bunx tsc --noEmit

check: lint format-check typecheck ## Run all checks (lint + format + types)

# ─── Security ───
audit: ## Check dependencies for known vulnerabilities
	bun audit 2>/dev/null || bunx npm-audit --json 2>/dev/null || echo "Run: bun pm ls to inspect deps manually"

audit-fix: ## Attempt to fix vulnerable dependencies
	bun update

# ─── Misc ───
codegen: ## Generate Sui TypeScript bindings
	bun run codegen

plugin: ## Create a new plugin (usage: make plugin name=my-plugin)
	@test -n "$(name)" || (echo "Usage: make plugin name=my-plugin" && exit 1)
	node scripts/create-plugin.mjs $(name)

sui-plugin: ## Create a new SUI plugin with dual-mode (usage: make sui-plugin name=token-swap)
	@test -n "$(name)" || (echo "Usage: make sui-plugin name=token-swap" && exit 1)
	node scripts/create-sui-plugin.mjs $(name)

clean: ## Remove build artifacts
	rm -rf dist node_modules/.vite

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
