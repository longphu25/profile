// BTC Chart — defer work until the browser is idle (with timeout fallback).

/** Schedule `fn` on idle time, or after `timeout` ms if the main thread stays busy. */
export function scheduleIdle(fn: () => void, options?: { timeout?: number }): void {
  const timeout = options?.timeout ?? 120
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(fn, { timeout })
    return
  }
  setTimeout(fn, 0)
}

/** Run `fn` on the next animation frame (paint-friendly). */
export function scheduleFrame(fn: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(fn)
    return
  }
  setTimeout(fn, 0)
}
