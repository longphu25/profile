# Predict Club — Development Makefile

# === Skills ===

.PHONY: skills-install skills-update skills-list

## Install all Sui skills from mystenlabs/skills
skills-install:
	npx skills add mystenlabs/skills --all -y

## Update all installed skills to latest
skills-update:
	npx skills update -y

## List installed skills
skills-list:
	npx skills ls

# === Contracts ===

.PHONY: move-build move-test move-clean

MOVE_DIR := contracts/predict-club

## Build Move contracts
move-build:
	cd $(MOVE_DIR) && sui move build

## Run Move unit tests
move-test:
	cd $(MOVE_DIR) && sui move test

## Clean Move build artifacts
move-clean:
	rm -rf $(MOVE_DIR)/build

# === Frontend ===

.PHONY: dev build lint

## Start dev server
dev:
	bun run dev

## Production build
build:
	bun run build

## Lint
lint:
	bun run lint

# === Combined ===

.PHONY: check all

## Run all checks (lint + move tests + build)
check: lint move-test build

## Full setup from scratch
all: skills-install move-build build
