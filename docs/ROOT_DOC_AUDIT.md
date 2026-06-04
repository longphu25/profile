# Root Documentation Audit

This audit classifies Markdown files currently located at `docs/*.md`. It
prevents cleanup from becoming a blind file move that breaks Obsidian links or
QMD lookup paths.

## Classification

| File | Current role | Recommendation | Reason |
| --- | --- | --- | --- |
| `README.md` | Harness map | Keep root | Primary docs entry point. |
| `INDEX.md` | Obsidian index | Keep root | Vault navigation surface. |
| `HARNESS.md` | Harness operating model | Keep root | Core repository-harness artifact. |
| `FEATURE_INTAKE.md` | Work classification | Keep root | Core repository-harness artifact. |
| `ARCHITECTURE.md` | Architecture boundaries | Keep root | Core repository-harness artifact. |
| `TEST_MATRIX.md` | Validation expectations | Keep root | Core repository-harness artifact. |
| `HARNESS_BACKLOG.md` | Harness improvement backlog | Keep root | Core repository-harness artifact. |
| `SETUP.md` | Agent/QMD/RTK setup | Keep root | Cross-cutting setup reference. |
| `QMD.md` | Local search setup | Keep root | Cross-cutting agent tooling reference. |
| `REFERENCE.md` | External references | Keep root | Cross-cutting reference map. |
| `ORGANIZATION.md` | Documentation placement rules | Keep root | Controls this audit and future docs moves. |
| `TERMINOLOGY.vi.md` | Vietnamese translation terminology | Keep root | Cross-cutting translation policy. |
| `project-overview.md` | Project guide | Keep root | Repo-wide onboarding map. |
| `repo-map.md` | Project guide | Keep root | Repo-wide folder map. |
| `runtime-entry-points.md` | Project guide | Keep root | Repo-wide runtime map. |
| `development-workflow.md` | Project guide | Keep root | Repo-wide workflow map. |
| `plugin-catalog.md` | Project guide | Keep root | Repo-wide plugin inventory. |
| `plugin-architecture.md` | Shared architecture | Keep root | Shared plugin runtime design. |
| `plugin-architecture-wasm.md` | Shared architecture | Keep root | Shared WASM dashboard design. |
| `plugin-wasm.md` | Shared architecture | Keep root | Shared WASM plugin loader rationale. |
| `plugin-sui-wallet.md` | Shared architecture | Keep root | Shared Sui wallet plugin boundary. |
| `plugin-ideas.md` | Backlog | Keep root for now | Cross-domain plugin backlog; can later split into stories. |
| `wasm-native.md` | Shared architecture | Keep root for now | Cross-domain WASM pipeline. Could move to a future `docs/wasm/` if the domain grows. |
| `deepbook-plugins.md` | Domain roadmap | Candidate: `docs/deepbook/plugins-roadmap.md` | DeepBook-specific; keep root only because existing `INDEX.md` links it as root-level plugin list. |

## Root Files To Keep Root

The following categories should stay at root:

- harness control plane,
- cross-cutting repo maps,
- shared plugin/runtime architecture,
- agent tooling setup,
- translation policy.

## Candidate Moves

Do not move these immediately without updating wiki links and QMD:

| Candidate | Proposed destination | Required follow-up |
| --- | --- | --- |
| `deepbook-plugins.md` | `docs/deepbook/plugins-roadmap.md` | Update `INDEX.md`, `INDEX.vi.md`, `deepbook/README.md`, QMD index. |
| `plugin-ideas.md` | `docs/stories/plugin-ideas.md` or split into story packets | Decide whether it is backlog or product roadmap. |
| `wasm-native.md` | `docs/wasm/native.md` | Create `docs/wasm/README.md` first if more WASM docs appear. |

## Decision

Keep the current root layout for now and make it explicit through
`ORGANIZATION.md`, `README.md`, and `INDEX.md`. Move files only when a domain
folder can own them cleanly and link updates are part of the same change.
