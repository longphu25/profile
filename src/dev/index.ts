// Dev-only tooling loader. No-op + tree-shaken in production because every
// import is gated behind `import.meta.env.DEV`.
//
// - react-scan: render-performance outlines + toolbar (spot wasted re-renders)
// - react-grab: copy any UI element with its source context (file:line) for agents
//
// Import this once at the top of an entry's main.tsx: `import '../dev'`.
if (import.meta.env.DEV) {
  // React Scan — initialise before first render where possible. Logging is off
  // to avoid console spam; the on-screen toolbar/outlines remain available.
  import('react-scan')
    .then(({ scan }) => scan({ enabled: true, log: false }))
    .catch(() => {
      // Optional dev tooling — ignore load failures.
    })

  // React Grab — element-to-source copy for agent workflows.
  import('react-grab').catch(() => {
    // Optional dev tooling — ignore load failures.
  })
}
