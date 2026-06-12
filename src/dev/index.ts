// Dev-only tooling loader. Both tools are OFF by default and opt-in via env
// flags, because each adds main-thread overhead in dev:
//   - react-scan instruments every component (profiling + canvas overlay)
//   - react-grab adds element-selection listeners
//
// Enable per tool in a local `.env` (see `.env.example`):
//   VITE_DEV_REACT_SCAN=true
//   VITE_DEV_REACT_GRAB=true
//
// Everything is gated behind `import.meta.env.DEV` so it is tree-shaken from
// production builds regardless of the flags.

function flagEnabled(value: unknown): boolean {
  return value === 'true' || value === '1' || value === true
}

if (import.meta.env.DEV) {
  if (flagEnabled(import.meta.env.VITE_DEV_REACT_SCAN)) {
    import('react-scan')
      .then(({ scan }) => scan({ enabled: true, log: false }))
      .catch(() => {
        // Optional dev tooling — ignore load failures.
      })
  }

  if (flagEnabled(import.meta.env.VITE_DEV_REACT_GRAB)) {
    import('react-grab').catch(() => {
      // Optional dev tooling — ignore load failures.
    })
  }
}
