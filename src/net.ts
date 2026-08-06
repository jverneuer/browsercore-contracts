/**
 * Platform-agnostic TCP and DNS contracts.
 *
 * These interfaces describe exactly what BrowserCore needs from a runtime —
 * nothing more. They are implemented by thin adapters (e.g. `browsersmith/src/net/node/`)
 * and injected into @browsercore/transport so the protocol stack stays
 * runtime-agnostic (Node, Bun, Deno, Cloudflare Workers, mocks).
 *
 * Design rule: expose only what transport consumes. Don't mirror Node's API.
 */

// ===========================================================================
// TCP
// ===========================================================================

/** Options for establishing a TCP connection. */
export interface ConnectOptions {
    /** Target host (IP literal or resolved address). */
    readonly host: string;
    /** Target port. */
    readonly port: number;
    /** Disable Nagle's algorithm. */
    readonly noDelay?: boolean;
    /** Local address to bind. */
    readonly localAddress?: string;
    /** IP family: 4 or 6. */
    readonly family?: 4 | 6;
}

/**
 * A connected TCP socket — the minimal surface transport needs.
 *
 * This is a structural subset of `node:net.Socket`. Any runtime socket that
 * satisfies these methods can be passed to BrowserCore.
 */
export interface Socket {
    /**
     * Write bytes. `cb` fires when data is accepted into the kernel buffer.
     * Returns `false` if the kernel buffer is full (backpressure).
     */
    write(data: Uint8Array, cb?: (err?: Error | null) => void): boolean;
    /** Gracefully close the writing side. */
    end(): void;
    /** Forcefully destroy the socket (optionally with an error). */
    destroy(error?: Error): void;
    /** True once the socket is destroyed. */
    readonly destroyed: boolean;
    /** Register a one-time listener. */
    once(event: "connect" | "close", listener: () => void): void;
    once(event: "error", listener: (err: Error) => void): void;
    /** Register a persistent listener. */
    on(event: "data", listener: (chunk: Uint8Array) => void): void;
    on(event: "drain" | "end", listener: () => void): void;
    on(event: "error", listener: (err: Error) => void): void;
    on(event: "close", listener: (hadError: boolean) => void): void;
}

/** Establish a TCP connection. */
export interface Net {
    connect(options: ConnectOptions): Socket;
}

// ===========================================================================
// DNS
// ===========================================================================

/** A resolved IP address. */
export interface IPAddress {
    /** The resolved IP address. */
    readonly address: string;
    /** Address family: 4 for IPv4, 6 for IPv6. */
    readonly family: 4 | 6;
}

/** DNS resolution abstraction. */
export interface DnsResolver {
    /**
     * Resolve a hostname to one or more IP addresses.
     * @param hostname - DNS name to resolve.
     * @param family - Preferred IP family (4 or 6).
     * @returns Resolved addresses (at least one).
     */
    lookup(hostname: string, family: 4 | 6): Promise<readonly IPAddress[]>;
}
