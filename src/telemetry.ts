/**
 * Platform-agnostic telemetry contracts — the injected observability surface.
 *
 * These interfaces describe the logging, tracing, and metrics surface that
 * BrowserCore needs. They are implemented by thin adapters (e.g.
 * `browsersmith/src/telemetry/node/`) and **injected** as `Platform.telemetry`.
 * Protocol packages call `logger.info`/`tracer.startSpan` against these
 * interfaces — never against a global logger or a specific SDK.
 *
 * Design rule: the interface is defined by what packages *consume*, not by
 * what any one telemetry backend provides. This keeps the stack portable
 * across runtimes and testable with a no-op telemetry adapter.
 */

/**
 * Structured logger — the minimal surface protocol packages need.
 */
export interface Logger {
    debug(message: string, attrs?: Readonly<Record<string, unknown>>): void;
    info(message: string, attrs?: Readonly<Record<string, unknown>>): void;
    warn(message: string, attrs?: Readonly<Record<string, unknown>>): void;
    error(message: string, attrs?: Readonly<Record<string, unknown>>): void;
}

/**
 * A single trace span.
 */
export interface Span {
    setAttribute(key: string, value: unknown): Span;
    end(): void;
}

/**
 * Tracer — creates spans.
 */
export interface Tracer {
    startSpan(name: string, attrs?: Readonly<Record<string, unknown>>): Span;
}

/**
 * Metrics counter/gauge recorder.
 */
export interface Metrics {
    add(name: string, value: number, attrs?: Readonly<Record<string, unknown>>): void;
}

/**
 * `Telemetry` — the injected observability bundle (part of `Platform`).
 *
 * Aggregates `Logger`, `Tracer`, and `Metrics` into a single object that
 * `browsersmith` assembles and passes down through `Platform.telemetry`.
 */
export interface Telemetry {
    readonly logger: Logger;
    readonly tracer: Tracer;
    readonly metrics: Metrics;
}
