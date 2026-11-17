/**
 * Tests for the time contracts exported from @browsercore/contracts.
 *
 * `Duration` is the only runtime value in this module — `Clock`,
 * `TimerHandle`, `Deadline`, `Scheduler`, and `Time` are interfaces erased at
 * compile time. We verify the factory math and exercise the interfaces via
 * mock implementations to confirm the contract shapes hold together.
 *
 * Since 0.2.6 `Clock` is THE canonical time contract (superseding the five
 * package-local sibling shapes) and `Time` is the Platform-bundle alias for
 * it — the mock below therefore implements the full canonical surface:
 * now/monotonic (ms), sleep, setTimeout/clearTimeout with an opaque
 * TimerHandle.
 */

import { describe, it, expect, vi } from "vitest";
import {
    Duration,
    type Clock,
    type Deadline,
    type Scheduler,
    type Time,
    type TimerHandle,
} from "../src/time.js";
// Compile-time check: the canonical Clock is part of the public SDK surface.
import type { Clock as PublicClock, TimerHandle as PublicTimerHandle } from "../src/index.js";

// ===========================================================================
// Duration factory
// ===========================================================================

describe("Duration.seconds", () => {
    it("reports milliseconds as seconds × 1000", () => {
        const d = Duration.seconds(5);
        expect(d.milliseconds).toBe(5000);
    });

    it("seconds() returns the original value", () => {
        const d = Duration.seconds(3);
        expect(d.seconds()).toBe(3);
    });

    it("handles zero", () => {
        const d = Duration.seconds(0);
        expect(d.milliseconds).toBe(0);
        expect(d.seconds()).toBe(0);
    });

    it("handles fractional seconds", () => {
        const d = Duration.seconds(0.5);
        expect(d.milliseconds).toBe(500);
        expect(d.seconds()).toBe(0.5);
    });
});

describe("Duration.milliseconds", () => {
    it("reports milliseconds as-is", () => {
        const d = Duration.milliseconds(2500);
        expect(d.milliseconds).toBe(2500);
    });

    it("seconds() returns milliseconds / 1000", () => {
        const d = Duration.milliseconds(1500);
        expect(d.seconds()).toBe(1.5);
    });

    it("handles zero", () => {
        const d = Duration.milliseconds(0);
        expect(d.milliseconds).toBe(0);
        expect(d.seconds()).toBe(0);
    });
});

// ===========================================================================
// Canonical Clock (0.2.6)
// ===========================================================================

/** A full canonical-Clock mock with spies on every operation. */
function createMockClock(): Clock {
    return {
        now: vi.fn<Clock["now"]>().mockReturnValue(1_700_000_000_000),
        monotonic: vi.fn<Clock["monotonic"]>().mockReturnValue(42_500),
        sleep: vi.fn<Clock["sleep"]>().mockResolvedValue(undefined),
        setTimeout: vi
            .fn<Clock["setTimeout"]>()
            .mockReturnValue({ timer: "opaque-handle" }),
        clearTimeout: vi.fn<Clock["clearTimeout"]>(),
    };
}

describe("Clock (canonical, 0.2.6)", () => {
    it("now() returns wall-clock epoch milliseconds", () => {
        const clock = createMockClock();
        expect(clock.now()).toBe(1_700_000_000_000);
    });

    it("monotonic() returns monotonic MILLISECONDS (a plain number)", () => {
        const clock = createMockClock();
        const value: number = clock.monotonic();
        expect(value).toBe(42_500);
    });

    it("sleep(ms) resolves after the requested milliseconds", async () => {
        const clock = createMockClock();
        await expect(clock.sleep(250)).resolves.toBeUndefined();
        expect(clock.sleep).toHaveBeenCalledWith(250);
    });

    it("setTimeout(ms, fn) returns an opaque TimerHandle; clearTimeout accepts it", () => {
        const clock = createMockClock();
        const handle: TimerHandle = clock.setTimeout(100, () => undefined);
        // TimerHandle is opaque (`object`) — only meaningful operation is
        // handing it back to clearTimeout.
        expect(typeof handle).toBe("object");
        clock.clearTimeout(handle);
        expect(clock.clearTimeout).toHaveBeenCalledWith(handle);
    });

    it("TimerHandle accepts any runtime's timer token (opaque by construction)", () => {
        // Node's Timeout, a plain token object, even a function token — all
        // are `object`, which is exactly why TimerHandle is `object`.
        const nodeLike: TimerHandle = { _onTimeout: (): void => undefined, ref(): void {} };
        const tokenLike: TimerHandle = () => undefined;
        const clock = createMockClock();
        clock.clearTimeout(nodeLike);
        clock.clearTimeout(tokenLike);
        expect(clock.clearTimeout).toHaveBeenCalledTimes(2);
    });

    it("spies are callable for assertion-driven tests", () => {
        const clock = createMockClock();
        clock.now();
        clock.monotonic();
        expect(clock.now).toHaveBeenCalledTimes(1);
        expect(clock.monotonic).toHaveBeenCalledTimes(1);
    });
});

// ===========================================================================
// Scheduler
// ===========================================================================

describe("Scheduler", () => {
    it("delay resolves after the requested duration", async () => {
        const scheduler: Scheduler = {
            delay: vi.fn<Scheduler["delay"]>().mockResolvedValue(undefined),
            timeout: () => new AbortController().signal,
            deadline: () => ({ signal: new AbortController().signal, expiresAt: 0 }),
        };

        const duration = Duration.seconds(1);
        await expect(scheduler.delay(duration)).resolves.toBeUndefined();
        expect(scheduler.delay).toHaveBeenCalledWith(duration);
    });

    it("delay forwards an optional abort signal", async () => {
        const scheduler: Scheduler = {
            delay: vi.fn<Scheduler["delay"]>().mockResolvedValue(undefined),
            timeout: () => new AbortController().signal,
            deadline: () => ({ signal: new AbortController().signal, expiresAt: 0 }),
        };

        const controller = new AbortController();
        const duration = Duration.milliseconds(100);
        await scheduler.delay(duration, controller.signal);

        expect(scheduler.delay).toHaveBeenCalledWith(duration, controller.signal);
    });

    it("timeout returns an AbortSignal", () => {
        const expected = new AbortController().signal;
        const scheduler: Scheduler = {
            delay: () => Promise.resolve(),
            timeout: vi.fn<Scheduler["timeout"]>().mockReturnValue(expected),
            deadline: () => ({ signal: new AbortController().signal, expiresAt: 0 }),
        };

        const duration = Duration.seconds(2);
        const result = scheduler.timeout(duration);

        expect(result).toBeInstanceOf(AbortSignal);
        expect(result).toBe(expected);
        expect(scheduler.timeout).toHaveBeenCalledWith(duration);
    });

    it("deadline composes a signal with an expiry timestamp in monotonic ms", () => {
        const controller = new AbortController();
        const expiresAt = 123_456;
        const scheduler: Scheduler = {
            delay: () => Promise.resolve(),
            timeout: () => new AbortController().signal,
            deadline: vi
                .fn<Scheduler["deadline"]>()
                .mockReturnValue({ signal: controller.signal, expiresAt }),
        };

        const duration = Duration.seconds(5);
        const result = scheduler.deadline(duration);

        expect(result.signal).toBe(controller.signal);
        expect(result.expiresAt).toBe(expiresAt);
        expect(scheduler.deadline).toHaveBeenCalledWith(duration);
    });
});

// ===========================================================================
// Time bundle — the Platform-bundle alias of Clock
// ===========================================================================

describe("Time (Platform-bundle alias of Clock)", () => {
    it("aliases the Clock surface — a Clock IS a Time and vice versa", () => {
        const clock: Clock = createMockClock();
        // Bidirectional aliasing: both assignments typecheck only if
        // Time and Clock are the same type.
        const time: Time = clock;
        const roundTrip: Clock = time;
        expect(roundTrip).toBe(clock);
    });

    it("surfaces the full canonical Clock surface through the bundle", () => {
        const time: Time = createMockClock();
        expect(time.now()).toBe(1_700_000_000_000);
        expect(time.monotonic()).toBe(42_500);
        expect(typeof time.sleep).toBe("function");
        expect(typeof time.setTimeout).toBe("function");
        expect(typeof time.clearTimeout).toBe("function");
    });

    it("satisfies the public SDK surface types", () => {
        const clock: PublicClock = createMockClock();
        const handle: PublicTimerHandle = clock.setTimeout(0, () => undefined);
        expect(typeof handle).toBe("object");
    });
});
