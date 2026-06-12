# Dev Tooling — React Scan & React Grab

> Two dev-only browser tools for debugging UI and feeding source context to
> agents. Both are gated behind `import.meta.env.DEV` and tree-shaken from
> production builds.

## Single dev loader

`src/dev/index.ts` loads both tools and is imported once per Vite entry:

```ts
import '../dev'
```

Wired into all `src/*/main.tsx` entries (app, predict-club, btc-chart,
deepbook, polymarket, sui-dashboard, sui-wasm, etc.).

Both tools are **OFF by default** and opt-in via env flags, because each adds
main-thread overhead in dev (react-scan instruments every component; react-grab
adds selection listeners). Enable in a local `.env`:

```bash
VITE_DEV_REACT_SCAN=true   # render-perf outlines + profiling
VITE_DEV_REACT_GRAB=true   # element -> source copy
```

```ts
if (import.meta.env.DEV) {
  if (flagEnabled(import.meta.env.VITE_DEV_REACT_SCAN)) {
    import('react-scan').then(({ scan }) => scan({ enabled: true, log: false }))
  }
  if (flagEnabled(import.meta.env.VITE_DEV_REACT_GRAB)) {
    import('react-grab')
  }
}
```

Restart `npm run dev` after changing flags. Everything is gated behind
`import.meta.env.DEV`, so it is tree-shaken from production regardless.

## React Scan (`react-scan@0.5.7`)

Render-performance visualiser: outlines components as they re-render so you can
spot wasted/excessive renders.

- On-screen toolbar + render outlines appear automatically in dev.
- `log: false` keeps the console quiet; flip to `true` when diagnosing.
- Complements `react-doctor` (`bun run doctor`) for static checks.

## React Grab (`react-grab@0.1.37`)

Copy any UI element with its component stack + `file:line` for agents:

1. Hover an element in a dev build.
2. Press ⌘C / Ctrl+C.
3. Paste into Codex/Kiro — context points the agent at the exact source.

### Codex MCP integration

`~/.codex/config.toml` enables the MCP server:

```toml
[mcp_servers.react-grab-mcp]
command = "npx"
args = [ "-y", "@react-grab/mcp", "--stdio" ]
enabled = true
```

Restart Codex after enabling so the MCP server loads.

## Usage

1. `bun run dev` (or `npm run dev`).
2. Open any page (e.g. `predict-club.html`).
3. React Scan outlines render live; use ⌘C/Ctrl+C with React Grab to copy
   element source context.

## Notes

- Both are dev-only; the `import.meta.env.DEV` guard keeps them out of prod.
- Load failures are swallowed — tooling is optional and never blocks the app.
