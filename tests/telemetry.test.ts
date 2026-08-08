/**
 * Tests for the telemetry contracts exported from @browsercore/contracts.
 *
 * The telemetry module defines interfaces only (Logger, Span, Tracer,
 * Metrics, Telemetry) — all erased at compile time. These tests verify
 * the contracts are satisfiable by constructing recording mocks that
 * implement each interface and asserting the expected call signatures.
 */

import { describe, it, expect, vi } from "vitest";
import type { Logger, Span, Tracer, Metrics, Telemetry } from "../src/telemetry.js";

// ---------------------------------------------------------------------------
// Recording-mock helpers — every call is captured with explicit types.
// ---------------------------------------------------------------------------

interface LogCall {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    attrs?: Readonly<Record<string, unknown>>;
}

interface SpanSetAttributeCall {
    key: string;
    value: unknown;
}

interface MetricsAddCall {
    name: string;
    value: number;
    attrs?: Readonly<Record<string, unknown>>;
}

function createRecordingLogger(): { logger: Logger; calls: LogCall[] } {
    const calls: LogCall[] = [];
    const logger: Logger = {
        debug(message: string, attrs?: Readonly<Record<string, unknown>>): void {
            calls.push({ level: "debug", message, attrs });
        },
        info(message: string, attrs?: Readonly<Record<string, unknown>>): void {
            calls.push({ level: "info", message, attrs });
        },
        warn(message: string, attrs?: Readonly<Record<string, unknown>>): void {
            calls.push({ level: "warn", message, attrs });
        },
        error(message: string, attrs?: Readonly<Record<string, unknown>>): void {
            calls.push({ level: "error", message, attrs });
        },
    };
    return { logger, calls };
}

function createRecordingSpan(initialAttrs: SpanSetAttributeCall[] = []): {
    span: Span;
    setAttributeCalls: SpanSetAttributeCall[];
    endCount: number;
} {
    const setAttributeCalls: SpanSetAttributeCall[] = [...initialAttrs];
    let endCount = 0;
    const span: Span = {
        setAttribute(key: string, value: unknown): Span {
            setAttributeCalls.push({ key, value });
            return span;
        },
        end(): void {
            endCount += 1;
        },
    };
    return { span, setAttributeCalls, get endCount() { return endCount; } };
}

function createRecordingTracer(): {
    tracer: Tracer;
    spansReturned: ReturnType<typeof createRecordingSpan>[];
    startSpanNames: string[];
} {
    const spansReturned: ReturnType<typeof createRecordingSpan>[] = [];
    const startSpanNames: string[] = [];
    const tracer: Tracer = {
        startSpan(name: string, _attrs?: Readonly<Record<string, unknown>>): Span {
            startSpanNames.push(name);
            const record = createRecordingSpan();
            spansReturned.push(record);
            return record.span;
        },
    };
    return { tracer, spansReturned, startSpanNames };
}

function createRecordingMetrics(): {
    metrics: Metrics;
    calls: MetricsAddCall[];
} {
    const calls: MetricsAddCall[] = [];
    const metrics: Metrics = {
        add(name: string, value: number, attrs?: Readonly<Record<string, unknown>>): void {
            calls.push({ name, value, attrs });
        },
    };
    return { metrics, calls };
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

describe("Logger", () => {
    it("records a debug message without attributes", () => {
        const { logger, calls } = createRecordingLogger();
        logger.debug("starting up");
        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual({ level: "debug", message: "starting up", attrs: undefined });
    });

    it("records an info message with attributes", () => {
        const { logger, calls } = createRecordingLogger();
        const attrs: Record<string, unknown> = { module: "fetch", attempt: 1 };
        logger.info("request sent", attrs);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.level).toBe("info");
        expect(calls[0]?.message).toBe("request sent");
        expect(calls[0]?.attrs).toBe(attrs);
    });

    it("records a warn message", () => {
        const { logger, calls } = createRecordingLogger();
        logger.warn("retry limit approaching");
        expect(calls).toEqual([{ level: "warn", message: "retry limit approaching", attrs: undefined }]);
    });

    it("records an error message with attributes", () => {
        const { logger, calls } = createRecordingLogger();
        const attrs: Record<string, unknown> = { code: "ECONNREFUSED" };
        logger.error("connection failed", attrs);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.level).toBe("error");
        expect(calls[0]?.message).toBe("connection failed");
        expect(calls[0]?.attrs).toBe(attrs);
    });

    it("accepts multiple calls across levels", () => {
        const { logger, calls } = createRecordingLogger();
        logger.debug("d");
        logger.info("i");
        logger.warn("w");
        logger.error("e");
        expect(calls.map((c: LogCall) => c.level)).toEqual(["debug", "info", "warn", "error"]);
    });
});

// ---------------------------------------------------------------------------
// Span
// ---------------------------------------------------------------------------

describe("Span", () => {
    it("setAttribute returns the span for chaining", () => {
        const { span, setAttributeCalls } = createRecordingSpan();
        const ret = span.setAttribute("http.method", "GET");
        expect(ret).toBe(span);
        expect(setAttributeCalls).toEqual([{ key: "http.method", value: "GET" }]);
    });

    it("setAttribute supports chained calls", () => {
        const { span, setAttributeCalls } = createRecordingSpan();
        span.setAttribute("http.method", "POST").setAttribute("http.path", "/api");
        expect(setAttributeCalls).toEqual([
            { key: "http.method", value: "POST" },
            { key: "http.path", value: "/api" },
        ]);
    });

    it("end is callable and records invocations", () => {
        const record = createRecordingSpan();
        expect(record.endCount).toBe(0);
        record.span.end();
        expect(record.endCount).toBe(1);
        record.span.end();
        expect(record.endCount).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// Tracer
// ---------------------------------------------------------------------------

describe("Tracer", () => {
    it("startSpan returns a usable Span", () => {
        const { tracer } = createRecordingTracer();
        const span = tracer.startSpan("http.request");
        span.setAttribute("http.method", "GET").end();
        // No throw — the returned object satisfies Span.
    });

    it("startSpan records the span name", () => {
        const { tracer, startSpanNames } = createRecordingTracer();
        tracer.startSpan("dns.lookup");
        tracer.startSpan("tls.handshake");
        expect(startSpanNames).toEqual(["dns.lookup", "tls.handshake"]);
    });

    it("startSpan accepts optional initial attributes without error", () => {
        const { tracer } = createRecordingTracer();
        const attrs: Record<string, unknown> = { host: "example.com" };
        const span = tracer.startSpan("connect", attrs);
        expect(span).toBeDefined();
    });

    it("each startSpan call returns a fresh span", () => {
        const { tracer, spansReturned } = createRecordingTracer();
        tracer.startSpan("a");
        tracer.startSpan("b");
        expect(spansReturned).toHaveLength(2);
        expect(spansReturned[0]).not.toBe(spansReturned[1]);
    });
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

describe("Metrics", () => {
    it("add records name and value without attributes", () => {
        const { metrics, calls } = createRecordingMetrics();
        metrics.add("http.requests", 1);
        expect(calls).toEqual([{ name: "http.requests", value: 1, attrs: undefined }]);
    });

    it("add records name, value, and attributes", () => {
        const { metrics, calls } = createRecordingMetrics();
        const attrs: Record<string, unknown> = { route: "/home", status: 200 };
        metrics.add("http.requests", 1, attrs);
        expect(calls).toEqual([{ name: "http.requests", value: 1, attrs }]);
    });

    it("add accumulates multiple recordings", () => {
        const { metrics, calls } = createRecordingMetrics();
        metrics.add("dns.lookup_ms", 12);
        metrics.add("dns.lookup_ms", 7);
        metrics.add("dns.lookup_ms", 21);
        expect(calls.map((c: MetricsAddCall) => c.value)).toEqual([12, 7, 21]);
    });

    it("add supports negative and fractional values", () => {
        const { metrics, calls } = createRecordingMetrics();
        metrics.add("gauge.temp", -3.5);
        expect(calls).toEqual([{ name: "gauge.temp", value: -3.5, attrs: undefined }]);
    });
});

// ---------------------------------------------------------------------------
// Telemetry bundle
// ---------------------------------------------------------------------------

describe("Telemetry", () => {
    it("bundles a Logger, Tracer, and Metrics", () => {
        const { logger } = createRecordingLogger();
        const { tracer } = createRecordingTracer();
        const { metrics } = createRecordingMetrics();

        const telemetry: Telemetry = { logger, tracer, metrics };

        // Exercise each surface through the bundle.
        telemetry.logger.info("ok");
        const span = telemetry.tracer.startSpan("work");
        span.end();
        telemetry.metrics.add("counter", 1);

        // Bundle exposes all three members as readonly references.
        expect(telemetry.logger).toBe(logger);
        expect(telemetry.tracer).toBe(tracer);
        expect(telemetry.metrics).toBe(metrics);
    });

    it("works when composed from recording mocks (spy verification)", () => {
        // Alternate path: also confirm the structure via vi.fn spies
        // for parity with the recording-mock approach.
        const logger: Logger = {
            debug: vi.fn<(message: string, attrs?: Readonly<Record<string, unknown>>) => void>(),
            info: vi.fn<(message: string, attrs?: Readonly<Record<string, unknown>>) => void>(),
            warn: vi.fn<(message: string, attrs?: Readonly<Record<string, unknown>>) => void>(),
            error: vi.fn<(message: string, attrs?: Readonly<Record<string, unknown>>) => void>(),
        };

        const endSpy = vi.fn<() => void>();
        const setAttributeSpy = vi.fn<(key: string, value: unknown) => Span>();
        const fakeSpan: Span = { setAttribute: setAttributeSpy, end: endSpy };

        const startSpanSpy = vi.fn<(name: string, attrs?: Readonly<Record<string, unknown>>) => Span>(
            (name: string, _attrs?: Readonly<Record<string, unknown>>): Span => fakeSpan,
        );
        const tracer: Tracer = { startSpan: startSpanSpy };

        const addSpy = vi.fn<(name: string, value: number, attrs?: Readonly<Record<string, unknown>>) => void>();
        const metrics: Metrics = { add: addSpy };

        const telemetry: Telemetry = { logger, tracer, metrics };

        telemetry.logger.info("hello", { a: 1 });
        const span = telemetry.tracer.startSpan("op", { k: "v" });
        span.setAttribute("x", 2);
        span.end();
        metrics.add("m", 3, { z: true });

        expect(logger.info).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith("hello", { a: 1 });
        expect(startSpanSpy).toHaveBeenCalledWith("op", { k: "v" });
        expect(setAttributeSpy).toHaveBeenCalledWith("x", 2);
        expect(endSpy).toHaveBeenCalledTimes(1);
        expect(addSpy).toHaveBeenCalledWith("m", 3, { z: true });
    });
});
