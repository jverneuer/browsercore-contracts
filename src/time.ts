/**
 * Platform-agnostic time contracts — the injected time surface.
 *
 * These interfaces describe what BrowserCore needs from a runtime's time and
 * scheduling facilities. They are implemented by thin adapters (e.g.
 * `browsersmith/src/time/node/`) and **injected** as `Platform.time`. Protocol
 * packages call `clock.now()` / `scheduler.delay()` against these interfaces —
 * never against `setTimeout` or `performance.now` directly — so the stack
 * stays runtime-agnostic and deterministically testable.
 *
 * Design rule: the interface is defined by what packages *consume*, not by
 * what any one runtime provides.
 */

/**
 * Time source — wall clock and monotonic counter.
 *
 * `monotonic()` returns high-resolution nanoseconds and MUST NOT
 * go backwards (unlike wall-clock `now()`).
 */
export interface Clock {
    /** Wall-clock time, epoch milliseconds. */
    now(): number;
    /** High-resolution monotonic time, nanoseconds. */
    monotonic(): bigint;
}

/**
 * A duration interval.
 *
 * Returned by the `Duration` factory. Both accessors reflect the same
 * interval in different units.
 */
export interface Duration {
    readonly milliseconds: number;
    seconds(): number;
}

/**
 * A deadline bound to an AbortSignal.
 */
export interface Deadline {
    readonly signal: AbortSignal;
    readonly expiresAt: bigint;
}

/**
 * Scheduler — creates delays, timeouts, and deadlines.
 */
export interface Scheduler {
    delay(duration: Duration, signal?: AbortSignal): Promise<void>;
    timeout(duration: Duration): AbortSignal;
    deadline(duration: Duration): Deadline;
}

/**
 * `Time` — the injected time bundle (part of `Platform`).
 *
 * Aggregates `Clock` and `Scheduler` into a single object that `browsersmith`
 * assembles and passes down through `Platform.time`.
 */
export interface Time {
    readonly clock: Clock;
    readonly scheduler: Scheduler;
}

// ===========================================================================
// Duration factory
// ===========================================================================

/**
 * `Duration` factory — pure function object, no runtime deps.
 *
 * Platform implementations use this to build `Duration` values; protocol
 * packages treat durations as opaque data. Pure data, no injection needed.
 */
export const Duration = {
    seconds: (n: number): Duration => ({ milliseconds: n * 1000, seconds: () => n }),
    milliseconds: (n: number): Duration => ({ milliseconds: n, seconds: () => n / 1000 }),
};
