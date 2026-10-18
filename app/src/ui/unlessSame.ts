/**
 * A state update that keeps the current value when the new one is equal
 * (2026-10-18).
 *
 * A screen that reads its data again builds new objects every time, and React
 * redraws whatever receives them even when nothing changed. Measured on the
 * P30: the passport drew its 81 stamps again on each return, about 300 ms,
 * and a stamp tapped meanwhile waited; the map redrew on every 10 s poll.
 * Compared by JSON, which is cheap at these sizes and right for plain data.
 */
export function unlessSame<T>(next: T): (current: T) => T {
  return (current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next);
}
