/**
 * Platform-agnostic event contracts — the injected event surface.
 *
 * BrowserCore never inherits from or depends on `node:events.EventEmitter`.
 * Instead, an `EventProvider` is implemented by a thin runtime adapter
 * (e.g. `browsersmith/src/events/node/`) and **injected** down through the
 * `Platform.events` field. The protocol stack calls `on`/`emit` against this
 * interface — never against a global or a Node builtin.
 *
 * Design rule: the interface is defined by what protocol packages *consume*,
 * not by what any one runtime provides. This keeps every package testable
 * with a mock emitter and portable across Node, Bun, Deno, and Workers.
 */

/**
 * `EventProvider` — the injected event surface for all protocol packages.
 *
 * This is the contract, not an inheritance hierarchy. Any runtime emitter
 * that satisfies these methods can be injected via `Platform.events`.
 * Packages never `extends EventEmitter`; they depend on this structural type.
 */
export interface EventProvider {
    on(event: string, listener: (...args: unknown[]) => void): void;
    once(event: string, listener: (...args: unknown[]) => void): void;
    off(event: string, listener: (...args: unknown[]) => void): void;
    removeListener(event: string, listener: (...args: unknown[]) => void): void;
    emit(event: string, ...args: unknown[]): boolean;
    listenerCount(event: string): number;
    removeAllListeners(event?: string): void;
}

/**
 * `TypedEventEmitter<T>` — compile-time typed event surface.
 *
 * Consumers define a map of event names to listener signatures and get
 * type-safe `emit`/`on` calls. This is the typed counterpart to the
 * untyped `EventProvider` — same injection pattern, stronger guarantees.
 */
export interface TypedEventEmitter<T extends Record<string, (...args: unknown[]) => void>> {
    on<K extends keyof T>(event: K, listener: T[K]): void;
    once<K extends keyof T>(event: K, listener: T[K]): void;
    off<K extends keyof T>(event: K, listener: T[K]): void;
    emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
}
