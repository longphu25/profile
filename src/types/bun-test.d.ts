declare module 'bun:test' {
  export interface TestContext {
    expect: (value: unknown) => Expectation
  }

  export const describe: (name: string, fn: () => void | Promise<void>) => void
  export const it: (name: string, fn: () => void | Promise<void>) => void
  export const test: (name: string, fn: () => void | Promise<void>) => void
  export const beforeEach: (fn: () => void | Promise<void>) => void
  export const afterEach: (fn: () => void | Promise<void>) => void

  export interface Expectation {
    toBe(expected: unknown): void
    toBeCloseTo(expected: number, precision?: number): void
    toBeGreaterThan(expected: number): void
    toBeGreaterThanOrEqual(expected: number): void
    toBeLessThan(expected: number): void
    toBeLessThanOrEqual(expected: number): void
    toBeNull(): void
    toContain(expected: string): void
    toEqual(expected: unknown): void
    toHaveLength(expected: number): void
    toThrow(expected?: string | RegExp | Error): void
    not: ExpectationNegated
  }

  export interface ExpectationNegated {
    toBe(expected: unknown): void
    toContain(expected: string): void
    toBeNull(): void
    toThrow(expected?: string | RegExp | Error): void
  }

  export const expect: (value: unknown) => Expectation
}
