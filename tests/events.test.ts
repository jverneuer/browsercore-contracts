/**
 * Tests for the event contracts exported from @browsercore/contracts.
 *
 * `EventProvider` and `TypedEventEmitter<T>` are interfaces — erased at
 * compile time — so these tests drive a minimal, self-contained mock
 * implementation through every surface method. Compile-time type safety
 * of the generic `TypedEventEmitter<T>` is exercised via `@ts-expect-error`
 * directives (validated by `tsc`, not the vitest runner).
 */

import { describe, it, expect, vi } from "vitest";
import type {
    EventProvider,
    TypedEventEmitter,
} from "../src/events.js";

// ---------------------------------------------------------------------------
// Internal listener type — matches EventProvider's parameter signature
// exactly: mutable `unknown[]` rest, void return. No `any`.
// ---------------------------------------------------------------------------
type Listener = (...args: unknown[]) => void;

// ---------------------------------------------------------------------------
// Minimal mock of EventProvider. Backed by a Map<string, Set<Listener>>.
// Self-contained: no external deps, no Node EventEmitter import.
// ---------------------------------------------------------------------------
class MockEventProvider implements EventProvider {
    private readonly listeners = new Map<string, Set<Listener>>();

    on(event: string, listener: Listener): void {
        const existing = this.listeners.get(event);
        if (existing === undefined) {
            this.listeners.set(event, new Set([listener]));
        } else {
            existing.add(listener);
        }
    }

    once(event: string, listener: Listener): void {
        const wrapper: Listener = (...args: unknown[]) => {
            this.off(event, wrapper);
            listener(...args);
        };
        this.on(event, wrapper);
    }

    off(event: string, listener: Listener): void {
        const existing = this.listeners.get(event);
        if (existing === undefined) return;
        existing.delete(listener);
        if (existing.size === 0) this.listeners.delete(event);
    }

    removeListener(event: string, listener: Listener): void {
        // Spec: removeListener is an alias for off.
        this.off(event, listener);
    }

    emit(event: string, ...args: unknown[]): boolean {
        const existing = this.listeners.get(event);
        if (existing === undefined || existing.size === 0) return false;
        // Copy to allow mutation during iteration (once/unsubscribe patterns).
        for (const listener of [...existing]) {
            listener(...args);
        }
        return true;
    }

    listenerCount(event: string): number {
        return this.listeners.get(event)?.size ?? 0;
    }

    removeAllListeners(event?: string): void {
        if (event === undefined) {
            this.listeners.clear();
        } else {
            this.listeners.delete(event);
        }
    }
}

// ---------------------------------------------------------------------------
// Concrete event map for TypedEventEmitter<T> testing.
//
// Must be a `type` alias (not an `interface`): only closed type aliases
// satisfy the `T extends Record<string, (...args: any[]) => void>` constraint.
// As a type alias, `keyof ClickEventMap` stays the specific union of keys,
// preserving per-event type safety.
// ---------------------------------------------------------------------------
type ClickEventMap = {
    click: (x: number, y: number) => void;
    navigate: (url: string) => void;
    error: (message: string, code: number) => void;
    ping: () => void;
};

// ---------------------------------------------------------------------------
// Concrete typed emitter — public API fully typed, delegates storage to the
// string-keyed MockEventProvider. Internal casts are confined to the mock;
// consumers see only the type-safe TypedEventEmitter<ClickEventMap> surface.
// ---------------------------------------------------------------------------
class ClickEventEmitter implements TypedEventEmitter<ClickEventMap> {
    private readonly provider = new MockEventProvider();

    on<K extends keyof ClickEventMap>(event: K, listener: ClickEventMap[K]): void {
        this.provider.on(event as string, listener as Listener);
    }

    once<K extends keyof ClickEventMap>(event: K, listener: ClickEventMap[K]): void {
        this.provider.once(event as string, listener as Listener);
    }

    off<K extends keyof ClickEventMap>(event: K, listener: ClickEventMap[K]): void {
        this.provider.off(event as string, listener as Listener);
    }

    emit<K extends keyof ClickEventMap>(
        event: K,
        ...args: Parameters<ClickEventMap[K]>
    ): boolean {
        return this.provider.emit(event as string, ...args);
    }
}

// ===========================================================================
// EventProvider — runtime behavior
// ===========================================================================
describe("EventProvider (mock)", () => {
    describe("on", () => {
        it("registers a listener and fires it on emit", () => {
            const provider: EventProvider = new MockEventProvider();
            const handler = vi.fn<Listener>();

            provider.on("click", handler);
            const fired = provider.emit("click", 1, 2);

            expect(fired).toBe(true);
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(1, 2);
        });

        it("supports multiple listeners on the same event", () => {
            const provider: EventProvider = new MockEventProvider();
            const first = vi.fn<Listener>();
            const second = vi.fn<Listener>();

            provider.on("ping", first);
            provider.on("ping", second);
            provider.emit("ping");

            expect(first).toHaveBeenCalledTimes(1);
            expect(second).toHaveBeenCalledTimes(1);
        });

        it("passes through arbitrary arguments to the listener", () => {
            const provider: EventProvider = new MockEventProvider();
            const handler = vi.fn<Listener>();

            provider.on("data", handler);
            provider.emit("data", "a", 42, { nested: true });

            expect(handler).toHaveBeenCalledWith("a", 42, { nested: true });
        });
    });

    describe("once", () => {
        it("fires the listener exactly once", () => {
            const provider: EventProvider = new MockEventProvider();
            const handler = vi.fn<Listener>();

            provider.once("init", handler);
            provider.emit("init");
            provider.emit("init");
            provider.emit("init");

            expect(handler).toHaveBeenCalledTimes(1);
        });

        it("forwards arguments to the once listener", () => {
            const provider: EventProvider = new MockEventProvider();
            const handler = vi.fn<Listener>();

            provider.once("tick", handler);
            provider.emit("tick", 99);

            expect(handler).toHaveBeenCalledWith(99);
        });

        it("removes the wrapper after firing, freeing listenerCount", () => {
            const provider: EventProvider = new MockEventProvider();
            const handler = vi.fn<Listener>();

            provider.once("boot", handler);
            expect(provider.listenerCount("boot")).toBe(1);

            provider.emit("boot");
            expect(provider.listenerCount("boot")).toBe(0);

            provider.emit("boot");
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe("off / removeListener", () => {
        it("removes a specific listener while keeping others", () => {
            const provider: EventProvider = new MockEventProvider();
            const keep = vi.fn<Listener>();
            const drop = vi.fn<Listener>();

            provider.on("event", keep);
            provider.on("event", drop);
            provider.off("event", drop);
            provider.emit("event");

            expect(keep).toHaveBeenCalledTimes(1);
            expect(drop).not.toHaveBeenCalled();
        });

        it("is a no-op when the listener was never registered", () => {
            const provider: EventProvider = new MockEventProvider();
            const handler = vi.fn<Listener>();

            // Must not throw.
            provider.off("missing", handler);
            expect(provider.listenerCount("missing")).toBe(0);
        });

        it("removeListener behaves identically to off", () => {
            const provider: EventProvider = new MockEventProvider();
            const keep = vi.fn<Listener>();
            const drop = vi.fn<Listener>();

            provider.on("event", keep);
            provider.on("event", drop);
            provider.removeListener("event", drop);
            provider.emit("event");

            expect(keep).toHaveBeenCalledTimes(1);
            expect(drop).not.toHaveBeenCalled();
        });

        it("clears the event entry when the last listener is removed", () => {
            const provider: EventProvider = new MockEventProvider();
            const handler = vi.fn<Listener>();

            provider.on("solo", handler);
            expect(provider.listenerCount("solo")).toBe(1);

            provider.off("solo", handler);
            expect(provider.listenerCount("solo")).toBe(0);
            expect(provider.emit("solo")).toBe(false);
        });
    });

    describe("emit", () => {
        it("returns true when at least one listener exists", () => {
            const provider: EventProvider = new MockEventProvider();
            provider.on("ping", () => {});

            expect(provider.emit("ping")).toBe(true);
        });

        it("returns false when no listener is registered", () => {
            const provider: EventProvider = new MockEventProvider();

            expect(provider.emit("ghost")).toBe(false);
        });

        it("returns false after all listeners are removed", () => {
            const provider: EventProvider = new MockEventProvider();
            const handler = vi.fn<Listener>();

            provider.on("temp", handler);
            provider.off("temp", handler);

            expect(provider.emit("temp")).toBe(false);
        });

        it("allows listeners to unsubscribe during emit without skipping peers", () => {
            const provider: EventProvider = new MockEventProvider();
            const peer = vi.fn<Listener>();
            const selfRemove = vi.fn<Listener>(() => {
                provider.off("burst", selfRemove);
            });

            provider.on("burst", selfRemove);
            provider.on("burst", peer);
            provider.emit("burst");

            // Both must fire — snapshot iteration prevents the unsubscribe
            // from skipping the peer registered after the mutating listener.
            expect(selfRemove).toHaveBeenCalledTimes(1);
            expect(peer).toHaveBeenCalledTimes(1);
        });
    });

    describe("listenerCount", () => {
        it("returns 0 for an event with no listeners", () => {
            const provider: EventProvider = new MockEventProvider();
            expect(provider.listenerCount("none")).toBe(0);
        });

        it("tracks the number of registered listeners per event", () => {
            const provider: EventProvider = new MockEventProvider();
            const a = vi.fn<Listener>();
            const b = vi.fn<Listener>();
            const c = vi.fn<Listener>();

            provider.on("multi", a);
            provider.on("multi", b);
            provider.on("multi", c);
            expect(provider.listenerCount("multi")).toBe(3);

            provider.off("multi", b);
            expect(provider.listenerCount("multi")).toBe(2);
        });

        it("is scoped per event name", () => {
            const provider: EventProvider = new MockEventProvider();
            provider.on("alpha", () => {});
            provider.on("alpha", () => {});
            provider.on("beta", () => {});

            expect(provider.listenerCount("alpha")).toBe(2);
            expect(provider.listenerCount("beta")).toBe(1);
        });
    });

    describe("removeAllListeners", () => {
        it("clears every listener when called with no argument", () => {
            const provider: EventProvider = new MockEventProvider();
            const a = vi.fn<Listener>();
            const b = vi.fn<Listener>();

            provider.on("x", a);
            provider.on("y", b);
            provider.removeAllListeners();

            expect(provider.listenerCount("x")).toBe(0);
            expect(provider.listenerCount("y")).toBe(0);
            expect(provider.emit("x")).toBe(false);
            expect(provider.emit("y")).toBe(false);
        });

        it("clears only the named event when called with an argument", () => {
            const provider: EventProvider = new MockEventProvider();
            const keep = vi.fn<Listener>();
            const drop = vi.fn<Listener>();

            provider.on("keep", keep);
            provider.on("drop", drop);
            provider.removeAllListeners("drop");

            expect(provider.listenerCount("drop")).toBe(0);
            expect(provider.listenerCount("keep")).toBe(1);

            provider.emit("keep");
            expect(keep).toHaveBeenCalledTimes(1);
            expect(drop).not.toHaveBeenCalled();
        });

        it("is a no-op for an event that has no listeners", () => {
            const provider: EventProvider = new MockEventProvider();
            provider.removeAllListeners("never");
            expect(provider.listenerCount("never")).toBe(0);
        });
    });
});

// ===========================================================================
// TypedEventEmitter<T> — runtime behavior + compile-time type safety
// ===========================================================================
describe("TypedEventEmitter<T>", () => {
    describe("runtime behavior (via concrete ClickEventEmitter)", () => {
        it("dispatches typed handlers with correct arguments", () => {
            const emitter: TypedEventEmitter<ClickEventMap> = new ClickEventEmitter();

            const received: Array<{ x: number; y: number }> = [];
            emitter.on("click", (x, y) => {
                received.push({ x, y });
            });

            const ok = emitter.emit("click", 10, 20);

            expect(ok).toBe(true);
            expect(received).toEqual([{ x: 10, y: 20 }]);
        });

        it("fires zero-argument events correctly", () => {
            const emitter: TypedEventEmitter<ClickEventMap> = new ClickEventEmitter();
            const handler = vi.fn<() => void>();

            emitter.on("ping", handler);
            emitter.emit("ping");

            expect(handler).toHaveBeenCalledTimes(1);
        });

        it("fires once-typed handlers exactly once", () => {
            const emitter: TypedEventEmitter<ClickEventMap> = new ClickEventEmitter();
            const handler = vi.fn<(url: string) => void>();

            emitter.once("navigate", handler);
            emitter.emit("navigate", "https://example.com");
            emitter.emit("navigate", "https://other.com");

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith("https://example.com");
        });

        it("removes a typed handler via off", () => {
            const emitter: TypedEventEmitter<ClickEventMap> = new ClickEventEmitter();
            const keep = vi.fn<(message: string, code: number) => void>();
            const drop = vi.fn<(message: string, code: number) => void>();

            emitter.on("error", keep);
            emitter.on("error", drop);
            emitter.off("error", drop);
            emitter.emit("error", "boom", 500);

            expect(keep).toHaveBeenCalledWith("boom", 500);
            expect(drop).not.toHaveBeenCalled();
        });
    });

    describe("compile-time type safety (@ts-expect-error)", () => {
        it("rejects wrong argument types for emit", () => {
            const emitter: TypedEventEmitter<ClickEventMap> = new ClickEventEmitter();

            // Correct call compiles cleanly:
            emitter.emit("click", 1, 2);

            // @ts-expect-error — emit("click") requires (number, number), not (string, string)
            emitter.emit("click", "bad", "args");

            // @ts-expect-error — emit("click") requires two numbers, not one
            emitter.emit("click", 1);

            // Runtime placeholder — real enforcement is at compile time.
            expect(true).toBe(true);
        });

        it("rejects unknown event names for emit", () => {
            const emitter: TypedEventEmitter<ClickEventMap> = new ClickEventEmitter();

            // @ts-expect-error — "nonexistent" is not in ClickEventMap
            emitter.emit("nonexistent");

            expect(true).toBe(true);
        });

        it("rejects handler signatures that don't match the map", () => {
            const emitter: TypedEventEmitter<ClickEventMap> = new ClickEventEmitter();

            // @ts-expect-error — "click" handler must be (number, number) => void
            emitter.on("click", (wrong: string) => {});

            // @ts-expect-error — "error" handler must be (string, number) => void
            emitter.on("error", (msg: number, code: string) => {});

            // @ts-expect-error — "ping" takes no arguments
            emitter.on("ping", (unexpected: number) => {});

            expect(true).toBe(true);
        });

        it("enforces handler argument count", () => {
            const emitter: TypedEventEmitter<ClickEventMap> = new ClickEventEmitter();

            // @ts-expect-error — "navigate" handler takes exactly one argument
            emitter.on("navigate", (a: string, extra: number) => {});

            expect(true).toBe(true);
        });
    });
});

// ---------------------------------------------------------------------------
// Static compile-time assertions. These lines must compile; if the contracts
// drift, `tsc` rejects the file. Kept outside `describe` so they are checked
// at type-check time, not as a vitest case.
// ---------------------------------------------------------------------------

// emit returns boolean
type EmitReturn = ReturnType<TypedEventEmitter<ClickEventMap>["emit"]>;
const _emitReturnsBoolean: true = (true as EmitReturn extends boolean ? true : false);

// on/once/off accept only keys from the map
type OnEventParam = Parameters<TypedEventEmitter<ClickEventMap>["on"]>[0];
const _onTakesKey: true = (true as OnEventParam extends keyof ClickEventMap ? true : false);

// Parameters are extracted from the mapped handler
type ClickParams = Parameters<ClickEventMap["click"]>;
const _clickParams: ClickParams = [1, 2];

// Suppress unused-local warnings for pure-type assertions.
void _emitReturnsBoolean;
void _onTakesKey;
void _clickParams;
