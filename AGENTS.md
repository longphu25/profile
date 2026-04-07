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
