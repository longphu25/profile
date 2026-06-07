export const MIN_HEALTH_FACTOR = 1.5

export function canBorrowSafely(healthFactor: number): boolean {
  return healthFactor >= MIN_HEALTH_FACTOR
}
