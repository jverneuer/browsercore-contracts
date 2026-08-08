/**
 * Platform-agnostic telemetry contracts.
 *
 * These interfaces describe the logging, tracing, and metrics surface
 * that BrowserCore needs. They are implemented by thin adapters
 * (e.g. `browsersmith/src/telemetry/node/`) and injected.
 *
 * Design rule: expose only what packages consume. Don't mirror any
 * specific telemetry SDK (OpenTelemetry, pino, etc.).
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
 * Aggregated telemetry bundle — passed down from the composition root.
 */
export interface Telemetry {
    readonly logger: Logger;
    readonly tracer: Tracer;
    readonly metrics: Metrics;
}
