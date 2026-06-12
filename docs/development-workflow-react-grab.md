# React Grab — Element-to-Source for Agents

> Copy any UI element (with its component stack + `file:line`) to paste into an
> agent. Speeds up "fix this exact element" requests.

## What it does

Hover any element in a dev build, press **⌘C / Ctrl+C**, and React Grab copies
the element plus its React component stack and source locations, e.g.:

```txt
[<button class="sui-swap__action">Swap</button> in SwapContent (at plugins/sui-swap/plugin.tsx:...)]
```

Paste that into Codex/Kiro to point the agent at the exact source.

## Setup in this repo (already wired)

- Dependency: `react-grab@0.1.37` (devDependency in `package.json`).
- Dev loader: `src/dev/react-grab.ts` — dynamically imports `react-grab` only
  when `import.meta.env.DEV`. No-op + tree-shaken in production builds.
- Every Vite entry imports it as the first line:

  ```ts
  import '../dev/react-grab'
  ```

  Applied to all `src/*/main.tsx` entries (app, predict-club, btc-chart,
  deepbook, polymarket, sui-dashboard, sui-wasm, etc.).

## Codex MCP integration

`~/.codex/config.toml` enables the MCP server so the agent can query grabbed
context programmatically:

```toml
[mcp_servers.react-grab-mcp]
command = "npx"
args = [ "-y", "@react-grab/mcp", "--stdio" ]
enabled = true
```

Restart Codex after enabling so the MCP server is picked up.

## Usage

1. `bun run dev` (or `npm run dev`).
2. Open any page (e.g. `predict-club.html`).
3. Hover an element → ⌘C/Ctrl+C → paste into the agent.

## Notes

- Dev-only: the import guard keeps React Grab out of production bundles.
- Related dev tooling already present: `react-scan` (render perf) and
  `react-doctor` (`bun run doctor`).
