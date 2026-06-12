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
- Use `docs/CONTEXT_RULES.md` to decide what to read per task phase and risk lane.
- Check `docs/stories/STATUS.md` for the current state of each plan before reusing one.
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

## Architecture & Design Principles

All code in this repo MUST follow these principles. Apply them to every feature, plugin, refactor, and fix:

### SOLID

- **Single Responsibility (SRP):** Each file, class, component, and function does exactly one thing.
  - Plugins: separate `lib/` (logic), `hooks/` (state), `components/` (UI), `plugin.tsx` (entry).
  - Never mix data-fetching, business logic, and rendering in the same file.
- **Open/Closed (OCP):** Extend behavior without modifying existing code.
  - Use adapter/strategy interfaces (e.g., `DexAdapter`) — add new implementations by registering, not editing.
- **Liskov Substitution (LSP):** Any implementation of an interface can replace another without breaking callers.
- **Interface Segregation (ISP):** Keep interfaces small and focused. Consumers import only the types they need.
- **Dependency Inversion (DIP):** Depend on abstractions (interfaces/types), not concrete classes.
  - Hooks and orchestrators receive adapters via interface, never import concrete classes directly for logic.

### Design Patterns (preferred)

- **Strategy Pattern** — for swappable behavior (DEX adapters, data providers, auth strategies).
- **Factory Pattern** — for creating configured instances (clients, transactions).
- **Observer/Hook Pattern** — for reactive state (React hooks, event subscriptions).
- **Facade Pattern** — for simplifying complex subsystems (barrel `index.ts` exports).
- **Composition over Inheritance** — prefer composing small pieces over deep class hierarchies.

### Clear Architecture

- **Layered structure:** `types → utils → adapters → orchestrator → hooks → components → plugin entry`
- **Barrel exports:** Every directory has an `index.ts` that exports public API only.
- **Explicit boundaries:** No circular imports. Dependencies flow one direction (inward/upward).
- **Naming:** Files named by what they ARE (noun) or DO (verb). No generic names like `helpers.ts` or `misc.ts`.
- **Colocation:** Keep related code together (component + its styles + its tests in same directory).

### Plugin Architecture Standard

Every plugin MUST follow this structure:

```
plugins/<name>/
├── plugin.tsx          # Entry — thin, only wires components to host API
├── style.css           # Scoped styles
├── components/         # UI components (SRP each)
│   └── index.ts        # Barrel export
├── hooks/              # React hooks (state + side effects)
│   └── index.ts        # Barrel export
└── lib/                # Pure logic, adapters, types
    ├── types.ts        # All interfaces and type definitions
    ├── utils.ts        # Pure utility functions
    ├── <adapter>.ts    # One file per external integration
    ├── router.ts       # Orchestrator (if multi-source)
    └── index.ts        # Barrel export
```

### Code Quality Gates

- No unused imports or variables (TypeScript strict).
- JSDoc on all public interfaces and exported functions.
- Prefer `readonly` for adapter properties that never change.
- Use `Promise.allSettled` for parallel fallible operations (never let one failure block others).
- Cache with TTL for repeated expensive calls.
- Debounce user input before triggering network requests.
