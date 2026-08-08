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
 *    ├── network    (TCP, DNS, UDP)
 *    ├── crypto     (CryptoProvider)
 *    ├── compression (gzip, deflate, brotli, etc.)
 *    ├── events     (EventProvider)
 *    ├── telemetry  (logger, tracer, metrics)
 *    └── time       (Clock + Scheduler)
 *
 * All fields are interfaces — this file has zero runtime behavior
 * and zero node:* imports.
 */

import type { Network } from "./net.js";
import type { CryptoProvider } from "./contracts.js";
import type { EventProvider } from "./events.js";
import type { Telemetry } from "./telemetry.js";
import type { Time } from "./time.js";

// ===========================================================================
// Compression
// ===========================================================================

/**
 * Synchronous compression/decompression bundle.
 *
 * Why sync: callers already own the hot path and want predictable latency.
 * Streaming variants belong on the implementation, not the contract.
 */
export interface Compression {
    gzipSync(data: Uint8Array): Uint8Array;
    gunzipSync(data: Uint8Array): Uint8Array;
    deflateSync(data: Uint8Array): Uint8Array;
    inflateSync(data: Uint8Array): Uint8Array;
    brotliCompressSync(data: Uint8Array): Uint8Array;
    brotliDecompressSync(data: Uint8Array): Uint8Array;
    decompressSync(data: Uint8Array): Uint8Array;
}

// ===========================================================================
// Crypto bundle
// ===========================================================================

/**
 * Aggregated crypto bundle — wraps CryptoProvider.
 */
export interface Crypto {
    readonly provider: CryptoProvider;
}

// ===========================================================================
// Platform root
// ===========================================================================

/**
 * Platform — the single composition root for all runtime services.
 *
 * Every protocol package receives the fields it needs. No package
 * hardwires node:* imports; all capabilities arrive via this object.
 */
export interface Platform {
    readonly network: Network;
    readonly crypto: Crypto;
    readonly compression: Compression;
    readonly events: EventProvider;
    readonly telemetry: Telemetry;
    readonly time: Time;
}
