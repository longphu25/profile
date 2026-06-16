---
name: project-conventions
description: Unwritten conventions for the predict-club SUI dApp repo. Use when writing or editing any code, docs, or commit in this project so output matches house style without being told each time.
user-invocable: false
---

# Project Conventions

House rules for this repo that are not obvious from the code alone. Apply them
silently to every edit, doc, and commit.

## Hard bans

- **No em-dash (`—`) in any visible string** — UI copy, docs, comments, commit
  messages. Use a regular hyphen with spaces, a colon, or split the sentence.
  This applies everywhere regardless of surface. (Origin: `design-taste-frontend`
  Section 9.G.)

## Imports across module boundaries

- Crossing `domain/` and `infrastructure/`: prefer `import type { ... }` for
  anything used only as a type. `infrastructure/deepbookPredictPricingService.ts`
  constructs a Sui RPC client at module level, so a plain value import drags that
  runtime side effect into pure `domain/` modules and unit tests.
- Only value-import the functions you actually call at runtime, and only in the
  allowed direction: `presentation -> infrastructure` is fine; `domain` must never
  value-import `infrastructure`.

## Docs

- Technical docs come in pairs: `NAME.md` (English) plus `NAME.vi.md`
  (Vietnamese). When you add or materially change one, update its sibling.
- Ground every API claim in installed `node_modules` source, not memory. The SDK
  moves fast; verify signatures before documenting them.

## Commits

- Conventional commits (`feat`, `fix`, `refactor`, `docs`, `chore`, `ci`).
- Subject line <= 100 chars (commitlint enforces this).
- Prefer small, coherent, revertable commits over one large one.
- Bump `package.json` version for non-trivial changes: `patch` for small fixes,
  `minor` for feature work. Skip only for typo/comment-only edits.

## Verification

- After code changes run `bun run build` (which is `tsc -b && vite build`), then
  `bun test tests/unit`. For studio/UI changes also run
  `bun scripts/predict-club-studio-smoke.mjs` against a preview build.
- The money path (mint/claim PTBs, unit scaling, coin selection) is normal-to-high
  risk: scale amounts with `parseToUnits` (exact bigint), never float math.

## Design skill stack (frontend work)

- Product/terminal UI (predict-club): `ui-ux-pro-max` leads (a11y > touch > perf >
  style; WCAG AA contrast, 44px targets, `prefers-reduced-motion`, tabular figures).
- Landing/marketing: `frontend-design` leads (bold, distinctive).
- Skills live in `.agents/skills/`, not `~/.claude/skills/`.
