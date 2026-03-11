/**
 * Advanceable clock module.
 *
 * Twins import this instead of using Date.now() directly.
 * In normal operation it returns real time. During tests,
 * time can be advanced or frozen via the admin endpoints.
 */

let offsetMs = 0;

/** Get current simulated timestamp (ms since epoch). */
export function now(): number {
  return Date.now() + offsetMs;
}

/** Advance the clock by the given number of milliseconds. */
export function advance(ms: number): void {
  offsetMs += ms;
}

/** Reset the clock to real time (offset = 0). */
export function reset(): void {
  offsetMs = 0;
}

/** Get the current offset in milliseconds (useful for debugging). */
export function getOffset(): number {
  return offsetMs;
}

const clock = { now, advance, reset, getOffset };
export default clock;
