/**
 * Platform-agnostic TCP and DNS contracts — the injected network surface.
 *
 * These interfaces describe exactly what BrowserCore needs from a runtime —
 * nothing more. They are implemented by thin adapters (e.g.
 * `browsersmith/src/net/node/`) and **injected** through `Platform.network`,
 * never imported directly by protocol packages. This keeps the stack
 * runtime-agnostic (Node, Bun, Deno, Cloudflare Workers, mocks).
 *
 * Design rule: the interface is defined by what transport *consumes*, not by
 * what any one runtime provides. Packages depend on this contract; runtimes
 * adapt to it.
 */

import type { UdpSocketFactory } from "./contracts.js";

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
 * `Socket` — the injected TCP socket surface.
 *
 * This is the contract that runtime adapters (Node, Bun, Deno, Workers)
 * must satisfy — defined by what `@browsercore/transport` *consumes*, not by
 * any one runtime's socket API. A socket is obtained via `Net.connect()`
 * (itself injected through `Platform.network.tcp`) and passed into transport,
 * never constructed by transport directly.
 *
 * Any runtime socket that satisfies these methods can be injected — no
 * inheritance from a built-in class required.
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

// ===========================================================================
// Network — aggregated network bundle
// ===========================================================================

/**
 * `Network` — the injected network bundle (part of `Platform`).
 *
 * Aggregates `Net`, `DnsResolver`, and the `UdpSocketFactory` into a single
 * object that `browsersmith` assembles and passes down through
 * `Platform.network`. Protocol packages never import `node:net` /
 * `node:dgram` directly.
 *
 * Every member is OPTIONAL (replaceability audit 2026-11-16, remediation
 * item #5): a platform provides exactly the capabilities its runtime has,
 * and a consumer resolves the member it needs before use — a missing member
 * is a typed, named failure at the point of use, never a silent stub. The
 * sanctioned pattern is `@browsercore/fetch`'s `proxyDialPlatform`
 * (`fetch/src/proxy.ts`): it reads only `network.tcp` (all schemes) and
 * `network.dns` (socks5 with a hostname target) and raises its own typed
 * error naming the missing capability when a required member is absent —
 * which is why `dns` stays genuinely `undefined` there instead of being
 * faked. Consumers should do the same: dereference defensively
 * (`platform.network?.tcp`) and throw an explicit error such as
 * `"platform.network.udp is not available on this runtime"` that names the
 * missing capability, so a wiring gap is diagnosable at the call site.
 */
export interface Network {
    /** TCP connect capability. Omitted by datagram-only or connectionless runtimes. */
    readonly tcp?: Net;
    /** DNS resolution capability. Omitted when the runtime cannot resolve (proxy remote-DNS paths). */
    readonly dns?: DnsResolver;
    /**
     * UDP datagram factory. A FACTORY, not a shared instance: `connect()`
     * returns a per-connection {@link UdpSocketFactory} socket so nothing is
     * bound at module-import time (the former instance shape forced
     * `browsersmith`'s import-time `createSocket("udp4")` singleton —
     * replaceability audit 2026-11-16). Omitted by runtimes without UDP
     * (e.g. Cloudflare Workers — HTTP/3 is unavailable there, HTTP/2 is not).
     */
    readonly udp?: UdpSocketFactory;
}
