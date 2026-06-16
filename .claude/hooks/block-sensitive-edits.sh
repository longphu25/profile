#!/usr/bin/env bash
# PreToolUse hook: block Write/Edit on sensitive files.
#
# Why: `.env` holds the testnet RPC config (VITE_TESTNET_RPC_URL) and any secrets;
# `bun.lock` is consumed by CI with --frozen-lockfile, so an accidental edit breaks
# the deploy build. Both are easy to clobber and costly to recover, so an agent edit
# to either is denied here before it happens. `.env.example` stays editable (it is the
# documented template, no secrets).
#
# Reads the PreToolUse JSON payload on stdin and emits a PreToolUse decision. Exit 0
# always (the decision is carried in the JSON, not the exit code).

input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')

if [ -z "$path" ]; then
  exit 0
fi

base=$(basename "$path")

deny() {
  jq -nc --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

case "$base" in
  .env|.env.local|.env.*.local)
    deny "Editing $base is blocked: it holds environment config/secrets. Edit .env.example instead, or change it by hand outside the agent."
    ;;
  bun.lock|package-lock.json|yarn.lock|pnpm-lock.yaml)
    deny "Editing $base is blocked: lock files are generated. CI installs with --frozen-lockfile, so a hand edit breaks the deploy. Run the package manager (bun install) to change it."
    ;;
esac

# .env.* that is NOT .example and NOT *.local (e.g. .env.production)
case "$base" in
  .env.example) : ;;  # template, allowed
  .env.*)
    deny "Editing $base is blocked: it is an environment file. Edit .env.example instead, or change it by hand outside the agent."
    ;;
esac

exit 0
