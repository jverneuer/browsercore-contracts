/**
 * Platform-agnostic time contracts — the injected time surface.
 *
 * These interfaces describe what BrowserCore needs from a runtime's time and
 * scheduling facilities. They are implemented by thin adapters (e.g.
 * `browsersmith/src/platform/time/node/`) and **injected** as `Platform.time`.
 * Protocol packages call `clock.now()` / `clock.sleep()` against these
 * interfaces — never against `setTimeout`, `Date.now`, or `performance.now`
 * directly — so the stack stays runtime-agnostic and deterministically
 * testable.
 *
 * Design rule: the interface is defined by what packages *consume*, not by
 * what any one runtime provides.
 */

/**
 * An opaque timer handle returned by {@link Clock.setTimeout}.
 *
 * Deliberately `object`, NOT `NodeJS.Timeout`/`number`: the runtime-coupling
 * audit (2026-11-16) flagged `NodeJS.Timeout` leaking into published `.d.ts`
 * (`transport/src/timers.ts` — the only `NodeJS.` reference polyrepo-wide) as
 * a platform-independence loss. Every runtime's timer token (Node's
 * `Timeout`, a browser's numeric id, a Workers `ScheduledController`) is an
 * `object` or boxes into one, so `object` is the maximal-width opaque token:
 * implementations hand back whatever they want, callers hand it to
 * {@link Clock.clearTimeout} and nothing else. Treating it as anything more
 * specific is a contract violation.
 */
export type TimerHandle = object;

/**
 * `Clock` — THE canonical time source for the entire stack.
 *
 * Supersedes (replaceability audit 2026-11-16, remediation item #6 +
 * runtime-coupling audit fact #3: "five incompatible sibling Clock interfaces
 * exist — tls/http1/http2/http3/quic each define their own"): the five
 * package-local shapes were —
 *
 *   tls   : { now(): number; sleep(ms): Promise<void> }
 *   http1 : { now(): number }
 *   http2 : { now(): number; setTimeout(cb, ms); clearTimeout(t) }
 *   http3 : { now(): number; setTimeout(cb, ms): () => void }   (disposer)
 *   quic  : { now(): number }
 *
 * This interface is the single shape all of them migrate onto (next wave):
 * their `options.clock` seams switch to importing this type, their local
 * declarations are deleted, and their bare `setTimeout`/`Date.now` call
 * sites route through an injected Clock. `@browsercore/transport`'s bare
 * timers (`timers.ts`) and `@browsercore/fetch`'s bare `setTimeout`
 * (`client.ts`, `pool.ts`) — the audit's top two behavioral-coupling
 * findings — migrate onto the same seam.
 *
 * Unit contract:
 *   - `now()` is WALL time (epoch ms, `Date.now()`-comparable) — for
 *     timestamps, logging, certificate validity. It CAN jump (NTP).
 *   - `monotonic()` is MONOTONIC time in ms — for elapsed/deadline math.
 *     Never compare `now()` against `monotonic()`; never use `Date.now()`
 *     deltas for deadlines (wall-clock drift corrupts timeouts).
 */
export interface Clock {
    /** Wall-clock time, epoch milliseconds (comparable with `Date.now()`). */
    now(): number;
    /** Monotonic time in milliseconds — never goes backwards; for elapsed/deadline math. */
    monotonic(): number;
    /** Resolve after `ms` milliseconds (replacement for bare `setTimeout`-as-sleep). */
    sleep(ms: number): Promise<void>;
    /** Run `fn` once after `ms` milliseconds; cancel via {@link clearTimeout}. */
    setTimeout(ms: number, fn: () => void): TimerHandle;
    /** Cancel a pending timer obtained from {@link setTimeout}. */
    clearTimeout(handle: TimerHandle): void;
}

/**
 * `Time` — the `Platform` bundle name for {@link Clock}.
 *
 * Alias kept so `Platform.time` reads as a bundle alongside
 * `network`/`crypto`; the underlying contract is THE Clock above (the former
 * `{ clock, scheduler }` bundle shape was implemented by zero protocol
 * packages — runtime-coupling audit 2026-11-16 — and the five sibling clocks
 * all bind the Clock surface directly, so the Clock IS the bundle).
 */
export type Time = Clock;

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
 *
 * `expiresAt` is in {@link Clock.monotonic} milliseconds (reconciled with the
 * canonical Clock in 0.2.6 — it was a `bigint` nanosecond value tied to the
 * old superseded Clock whose `monotonic()` returned ns; with `monotonic()`
 * now in ms, the deadline unit matches so `scheduler.deadline()` results stay
 * comparable against the injected clock).
 */
export interface Deadline {
    readonly signal: AbortSignal;
    readonly expiresAt: number;
}

/**
 * Scheduler — creates delays, timeouts, and deadlines.
 *
 * Kept for callers that compose `Duration`-based scheduling; the five sibling
 * clock migrations bind {@link Clock} directly (`sleep`/`setTimeout` cover
 * the same ground without pre-wrapping durations).
 */
export interface Scheduler {
    delay(duration: Duration, signal?: AbortSignal): Promise<void>;
    timeout(duration: Duration): AbortSignal;
    deadline(duration: Duration): Deadline;
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
