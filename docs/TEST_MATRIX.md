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
| Predict Club | `bun run build`; `bun run test:e2e`; smoke load `predict-club.html`; verify Shadow DOM plugin load, responsive layout, stale-oracle blocking, and member self-sign wallet-flow review. |
| WASM | Build plus verify generated/copied `.wasm` and loader paths. |
| Move contracts | `sui move build` in the affected package. |

## Known Commands

```bash
bun run build
bun run lint
bun run format:check
bun run test:e2e
bun run test:e2e:report
```

Use Bun by default because the repo has `bun.lock`.

## Playwright E2E

Predict Club now has a smoke suite at `tests/e2e/predict-club.spec.ts`.

The suite starts Vite through `playwright.config.ts`, opens
`predict-club.html`, verifies the hydrated multi-slot plugin, opens the funding
modal, and checks the member-facing wallet/PredictManager/DUSDC gate.

Artifacts:

- failures keep screenshots, video, and trace under `test-results/artifacts/`
- HTML report is generated under `test-results/html/`
- these paths are ignored by git

Before running E2E on a fresh machine, install the browser binary:

```bash
bunx playwright install chromium
```

## Current Gaps

- No dedicated docs link checker is configured.
- Wallet-extension flows still need manual proof unless a task adds a mocked
  wallet fixture or scripted wallet provider.
- Network transaction success still needs a real wallet run against the target
  Sui network.
