## Repo Notes

- Before commit/push, bump the `package.json` version for any change that is more than trivially small.
- Choose the version bump based on the scope of the update: use `patch` for small user-facing fixes or routine maintenance, and use `minor` for broader feature work or meaningfully expanded behavior.
- You may skip the version bump only for truly tiny changes such as a single typo fix or comment-only edits.

## Sui SDK Reference

Every @mysten/* package ships LLM documentation in its `docs/` directory. When working with these
packages, find the relevant docs by looking for `docs/llms-index.md` files inside
`node_modules/@mysten/*/`. Read the index first to find the page you need, then read that page for
details.

For Sui TypeScript SDK 2.0 migration guidance (breaking changes, new client APIs, client extensions,
dApp Kit rewrite, etc.), see `.agents/skills/sui-sdk-2-migration/SKILL.md`.

## Project Harness

- Start docs work at `docs/README.md`, `docs/HARNESS.md`, and `docs/FEATURE_INTAKE.md`.
- Use `docs/product/` for stable product truth, `docs/stories/` for scoped plans/work packets,
  `docs/decisions/` for durable tradeoffs, and existing domain folders for technical depth.
- For local docs search, prefer `qmd search ... -c profile-docs` and `qmd get ...`.
  Do not use `qmd query` unless explicitly needed, because it can use local GGUF models.

## Source Search

- For source-code search and impact tracing, prefer `codegraph` MCP queries over `rg`
  when CodeGraph is available in the current agent environment.
- Use `rg` only for simple file discovery or when CodeGraph is unavailable.
- Keep `codegraph` indexed after major source changes by running `bun run codegraph:index`
  or `bash scripts/setup-codegraph.sh --no-agent-install`.
