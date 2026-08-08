/**
 * Platform-agnostic event contracts.
 *
 * These interfaces describe what BrowserCore needs from an event system.
 * They are implemented by thin adapters (e.g. `browsersmith/src/events/node/`)
 * and injected so the protocol stack stays runtime-agnostic.
 *
 * Design rule: expose only what transport/protocol packages consume.
 * Don't mirror Node's EventEmitter API.
 */

/**
 * Minimal event emitter surface — the structural subset of
 * `node:events.EventEmitter` that BrowserCore depends on.
 *
 * Any runtime emitter that satisfies these methods can be injected.
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
 * Typed event emitter — maps event names to their listener signatures.
 *
 * Consumers define a map of event handlers and get compile-time
 * type safety on `emit` arguments and `on` callbacks.
 */
export interface TypedEventEmitter<T extends Record<string, (...args: unknown[]) => void>> {
    on<K extends keyof T>(event: K, listener: T[K]): void;
    once<K extends keyof T>(event: K, listener: T[K]): void;
    off<K extends keyof T>(event: K, listener: T[K]): void;
    emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
}
