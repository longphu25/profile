# Test Matrix

Use this matrix to choose validation for a change. Update it when the repo gains
new reliable checks.

| Work type | Minimum proof |
| --- | --- |
| Docs-only | Inspect changed links and run a docs path check when paths moved. |
| Package/config | `bun run build` when dependencies are available. |
| React UI | `bun run build`; add browser smoke check for user-visible pages. |
| Plugin runtime | `bun run build`; smoke load the affected dashboard entry. |
| Sui wallet/signing | Build plus manual or scripted wallet-flow review; do not claim network success without running it. |
| Predict Club | `bun run build`; smoke load `predict-club.html`; verify Shadow DOM plugin load, responsive layout, stale-oracle blocking, and member self-sign wallet-flow review. |
| WASM | Build plus verify generated/copied `.wasm` and loader paths. |
| Move contracts | `sui move build` in the affected package. |

## Known Commands

```bash
bun run build
bun run lint
bun run format:check
```

Use Bun by default because the repo has `bun.lock`.

## Current Gaps

- No dedicated docs link checker is configured.
- No stable E2E smoke suite is documented.
- Wallet and provider flows still need manual proof unless a task adds scripted
  coverage.
