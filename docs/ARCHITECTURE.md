# Architecture

This file is the navigation layer for architecture work. Keep detailed technical
notes in the existing domain files and use this page to choose what to read.

## Core Boundaries

| Boundary | Source docs | Code area |
| --- | --- | --- |
| Portfolio shell | `project-overview.md`, `runtime-entry-points.md` | `src/main.tsx`, `src/Portfolio.tsx` |
| Generic plugin runtime | `plugin-architecture.md` | `src/plugins/`, `src/plugin-demo/` |
| Sui dashboard runtime | `plugin-architecture-wasm.md`, `plugin-sui-wallet.md` | `src/sui-dashboard/`, `src/sui-wasm/` |
| Plugin business logic | `plugin-catalog.md`, domain docs | `plugins/` |
| WASM plugins | `wasm-native.md`, `plugin-wasm.md` | `plugins/*/pkg`, `public/wasm/` |
| Move contracts | `contracts/SEAL-POLICY.md` | `contracts/` |

## Boundary Rules

- `src/plugins/` is runtime/kernel code, not business feature code.
- `plugins/<name>/` owns plugin-specific UI, state, and integration logic.
- Sui plugins running in the shared dashboard should use host wallet context
  instead of creating a separate wallet provider.
- Production plugin loading depends on `vite.config.ts` and copied plugin CSS.
- WASM package paths must be checked in both dev and production modes.

## Architecture Change Policy

Record a decision under `decisions/` when a change alters:

- plugin loading or registration rules
- `HostAPI` or shared Sui wallet contracts
- signing or transaction execution boundaries
- production build output paths
- Move object ownership or authorization assumptions
- validation requirements for a domain
