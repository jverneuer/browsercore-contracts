/**
 * Platform — the root composition interface.
 *
 * This is the single object that browsersmith assembles and passes down
 * to every protocol package. Each field is a service bundle that groups
 * related platform capabilities (network, crypto, compression, events,
 * telemetry, time).
 *
 * Architecture:
 *
 *   browsersmith (composition root)
 *        │
 *        ▼
 *   Platform
 *    ├── network?     (TCP, DNS, UDP socket factory — each member optional)
 *    ├── crypto?      (CryptoProvider)
 *    ├── compression? (gzip, deflate, brotli, etc.)
 *    ├── events?      (EventProvider)
 *    ├── telemetry?   (logger, tracer, metrics)
 *    └── time?        (Clock — the canonical time contract)
 *
 * All fields are interfaces — this file has zero runtime behavior
 * and zero node:* imports.
 */

import type { Network, Net, DnsResolver } from "./tcp-transport.js";
import type { CryptoProvider, CompressionProvider, UdpSocketFactory } from "./contracts.js";
import type { EventProvider } from "./events.js";
import type { Telemetry } from "./telemetry.js";
import type { Time } from "./time.js";

// ===========================================================================
// Compression
// ===========================================================================

/**
 * `Compression` — the injected synchronous compression bundle (part of `Platform`).
 *
 * Alias for {@link CompressionProvider}: the single source of truth for the
 * compression contract. The async `encode/decode(ContentEncoding)` shape had
 * zero consumers and is dropped.
 *
 * Injected as `Platform.compression`; protocol packages receive it through
 * options, never by importing `node:zlib` directly.
 */
export type Compression = CompressionProvider;

// ===========================================================================
// Crypto bundle
// ===========================================================================

/**
 * `Crypto` — the injected crypto bundle (part of `Platform`).
 *
 * Wraps `CryptoProvider` for injection. `browsersmith` populates this from
 * `@browsercore/crypto`; protocol packages reach it through options, never
 * by importing `node:crypto` directly.
 */
export interface Crypto {
    readonly provider: CryptoProvider;
}

// ===========================================================================
// Platform root
// ===========================================================================

/**
 * `Platform` — the single composition root for all runtime services.
 *
 * Assembled **once** by `browsersmith` (the only package with `node:*`
 * imports) and threaded down through options to every protocol package.
 * No package hardwires runtime imports; all capabilities arrive via this
 * object. This is the seam that makes BrowserCore portable and testable.
 *
 * Every bundle is OPTIONAL (replaceability audit 2026-11-16, remediation
 * item #5: "Platform all-or-nothing with REQUIRED udp" forced consumers to
 * lie to the type system). A platform now carries exactly the capabilities
 * its runtime has — a UDP-less runtime (Cloudflare Workers) omits
 * `network.udp`, a crypto-less test platform omits `crypto`. Consumers
 * resolve the bundle they use and, when it is absent, throw a typed error
 * that names the missing capability. The sanctioned pattern already exists:
 * `@browsercore/fetch`'s `proxyDialPlatform` (`fetch/src/proxy.ts`) assembles
 * a minimal platform whose untouched bundles are throwing getters naming the
 * culprit — with optional bundles the same guarantee is expressed by simply
 * omitting the field, and consumers write
 * `platform.network?.tcp ?? throw new MissingCapabilityError("platform.network.tcp")`.
 *
 * Implementers may still provide every bundle (browsersmith's `createPlatform()`
 * does) — an implementation that provides more than a consumer requires
 * always satisfies the interface. Optionality only removes the obligation to
 * FAKE capabilities a runtime lacks.
 */
export interface Platform {
    /** Network bundle (TCP, DNS, UDP factory) — each member independently optional. */
    readonly network?: Network;
    readonly crypto?: Crypto;
    readonly compression?: Compression;
    readonly events?: EventProvider;
    readonly telemetry?: Telemetry;
    readonly time?: Time;
}

// ===========================================================================
// Platform options
// ===========================================================================

/**
 * Options for overriding individual platform adapters.
 *
 * Every field is optional — omit a field to use the default implementation.
 * Use this in tests to inject mocks, or in production to swap a backend.
 */
export interface PlatformOptions {
    readonly network?: {
        readonly tcp?: Net;
        readonly dns?: DnsResolver;
        readonly udp?: UdpSocketFactory;
    };
    readonly crypto?: {
        readonly provider?: CryptoProvider;
    };
    readonly compression?: Compression;
    readonly events?: EventProvider;
    readonly telemetry?: Telemetry;
    readonly time?: Time;
}
