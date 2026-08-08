/**
 * Tests for the time contracts exported from @browsercore/contracts.
 *
 * `Duration` is the only runtime value in this module — `Clock`, `Deadline`,
 * `Scheduler`, and `Time` are interfaces erased at compile time. We verify
 * the factory math and exercise the interfaces via mock implementations to
 * confirm the contract shapes hold together.
 */

import { describe, it, expect, vi } from "vitest";
import {
    Duration,
    type Clock,
    type Deadline,
    type Scheduler,
    type Time,
} from "../src/time.js";

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
// Clock
// ===========================================================================

describe("Clock", () => {
    it("now() returns the wall-clock epoch milliseconds", () => {
        const clock: Clock = {
            now: () => 1_700_000_000_000,
            monotonic: () => 0n,
        };
        expect(clock.now()).toBe(1_700_000_000_000);
    });

    it("monotonic() returns a bigint nanosecond counter", () => {
        const clock: Clock = {
            now: () => 0,
            monotonic: () => 123_456_789n,
        };
        expect(clock.monotonic()).toBe(123_456_789n);
    });

    it("can be driven by mock functions for assertions", () => {
        const nowSpy = vi.fn<Clock["now"]>().mockReturnValue(1_700_000_000_000);
        const monotonicSpy = vi
            .fn<Clock["monotonic"]>()
            .mockReturnValue(987_654_321n);
        const clock: Clock = { now: nowSpy, monotonic: monotonicSpy };

        clock.now();
        clock.monotonic();

        expect(nowSpy).toHaveBeenCalledTimes(1);
        expect(monotonicSpy).toHaveBeenCalledTimes(1);
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
            deadline: () => ({ signal: new AbortController().signal, expiresAt: 0n }),
        };

        const duration = Duration.seconds(1);
        await expect(scheduler.delay(duration)).resolves.toBeUndefined();
        expect(scheduler.delay).toHaveBeenCalledWith(duration);
    });

    it("delay forwards an optional abort signal", async () => {
        const scheduler: Scheduler = {
            delay: vi.fn<Scheduler["delay"]>().mockResolvedValue(undefined),
            timeout: () => new AbortController().signal,
            deadline: () => ({ signal: new AbortController().signal, expiresAt: 0n }),
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
            deadline: () => ({ signal: new AbortController().signal, expiresAt: 0n }),
        };

        const duration = Duration.seconds(2);
        const result = scheduler.timeout(duration);

        expect(result).toBeInstanceOf(AbortSignal);
        expect(result).toBe(expected);
        expect(scheduler.timeout).toHaveBeenCalledWith(duration);
    });

    it("deadline composes a signal with an expiry timestamp", () => {
        const controller = new AbortController();
        const expiresAt = 123_456_789n;
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
// Time bundle
// ===========================================================================

describe("Time", () => {
    it("bundles a clock and a scheduler", () => {
        const clock: Clock = { now: () => 0, monotonic: () => 0n };
        const scheduler: Scheduler = {
            delay: () => Promise.resolve(),
            timeout: () => new AbortController().signal,
            deadline: () => ({ signal: new AbortController().signal, expiresAt: 0n }),
        };

        const time: Time = { clock, scheduler };

        expect(time.clock).toBe(clock);
        expect(time.scheduler).toBe(scheduler);
    });

    it("surfaces clock and scheduler methods through the bundle", () => {
        const clock: Clock = {
            now: () => 1_700_000_000_000,
            monotonic: () => 5_000_000n,
        };
        const scheduler: Scheduler = {
            delay: () => Promise.resolve(),
            timeout: () => new AbortController().signal,
            deadline: () => ({ signal: new AbortController().signal, expiresAt: 10n }),
        };

        const time: Time = { clock, scheduler };

        expect(time.clock.now()).toBe(1_700_000_000_000);
        expect(time.clock.monotonic()).toBe(5_000_000n);
        expect(time.scheduler.timeout(Duration.seconds(1))).toBeInstanceOf(AbortSignal);
    });
});
