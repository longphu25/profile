// Dev-only: load React Grab so any UI element can be copied with its source
// context (component stack + file:line) for agent-assisted debugging.
//
// Usage: import this module once at the top of an entry's main.tsx.
// It is a no-op in production — the dynamic import is gated behind
// `import.meta.env.DEV`, so React Grab is tree-shaken out of prod builds.
if (import.meta.env.DEV) {
  import('react-grab').catch(() => {
    // React Grab is optional tooling; ignore load failures.
  })
}
