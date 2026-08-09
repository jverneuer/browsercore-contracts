/**
 * Contracts — interfaces that define how BrowserCore components communicate.
 *
 * Litmus test: "Could another package reasonably import this type?"
 * If yes → belongs here. If only one protocol touches it → stays in that package.
 */

import type {
    ContentEncoding,
    Cookie,
    DatagramCloseReason,
    EcdhCurve,
    EcdhKeyPair,
    FetchOptions,
    FetchResponse,
    HashId,
    ProtocolFrame,
    Request,
    Response,
    TransportState,
    CloseReason,
    TlsState,
    UdpAddress,
    X25519KeyPair,
} from "./models.js";

// ===========================================================================
// Provider Contracts (I/O boundary)
// ===========================================================================

/**
 * `CryptoProvider` — the injected cryptographic primitive surface.
 *
 * Implemented by: `@browsercore/crypto`
 *
 * Why here: Every protocol package needs crypto operations. The provider is
 * assembled into `Platform.crypto` by the composition root (`browsersmith`)
 * and threaded down through options — no protocol package imports
 * `node:crypto` or any runtime builtin directly.
 */
export interface CryptoProvider {
    randomBytes(length: number): Uint8Array;
    sha256(data: Uint8Array): Uint8Array;
    sha384(data: Uint8Array): Uint8Array;
    hkdf(hash: HashId, salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Uint8Array;
    hmac(hash: HashId, key: Uint8Array, data: Uint8Array): Uint8Array;
    aes128GcmEncrypt(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Uint8Array;
    aes128GcmDecrypt(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array, aad: Uint8Array): Uint8Array;
    aes256GcmEncrypt(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Uint8Array;
    aes256GcmDecrypt(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array, aad: Uint8Array): Uint8Array;
    aes128CcmEncrypt(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Uint8Array;
    aes128CcmDecrypt(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array, aad: Uint8Array): Uint8Array;
    chacha20Poly1305Encrypt(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Uint8Array;
    chacha20Poly1305Decrypt(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array, aad: Uint8Array): Uint8Array;
    x25519GenerateKeyPair(): X25519KeyPair;
    x25519SharedSecret(secretKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array;
    ecdhGenerateKeyPair(curve: EcdhCurve): EcdhKeyPair;
    ecdhSharedSecret(curve: EcdhCurve, secretKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array;
    verifySignature(scheme: string, publicKey: Uint8Array, signature: Uint8Array, data: Uint8Array): boolean;
    aesEcbEncrypt(key: Uint8Array, block: Uint8Array): Uint8Array;
}

/**
 * `CompressionProvider` — the injected compression surface.
 *
 * Implemented by: `@browsercore/compression`
 *
 * Why here: HTTP/1 and HTTP/2 both need compression. Provided via
 * `Platform.compression` and passed down through options — protocols never
 * bind to `node:zlib` directly. All operations are synchronous and
 * unit-testable. Portable across backends (node:zlib, WebCompressionStream,
 * wasm brotli).
 *
 * The async `encode/decode(ContentEncoding)` shape had zero consumers and is
 * dropped. This sync shape is the single source of truth.
 */
export interface CompressionProvider {
    /** Compress `data` with gzip. */
    gzip(data: Uint8Array): Uint8Array;
    /** Decompress a gzip-encoded `data`. */
    gunzip(data: Uint8Array): Uint8Array;

    /** Compress `data` with zlib-wrapped deflate. */
    deflate(data: Uint8Array): Uint8Array;
    /** Decompress a zlib-wrapped deflate `data`. */
    inflate(data: Uint8Array): Uint8Array;

    /** Decompress a raw (headerless) deflate `data`. */
    inflateRaw(data: Uint8Array): Uint8Array;

    /** Compress `data` with brotli. */
    brotliCompress(data: Uint8Array): Uint8Array;
    /** Decompress a brotli-encoded `data`. */
    brotliDecompress(data: Uint8Array): Uint8Array;

    /** Decompress a body according to a `content-encoding` header value. */
    decompress(data: Uint8Array, encoding: ContentEncoding): Uint8Array;
}

/**
 * `Transport` — the injected reliable byte stream (TCP).
 *
 * Implemented by: `@browsercore/transport`
 *
 * Why here: TLS, HTTP/1, HTTP/2 all consume `Transport`. It is created by the
 * injected `Platform.network.tcp` adapter and passed down through options —
 * never constructed by the protocols themselves.
 *
 * Event methods (`on`/`once`) are typed narrowly for stream semantics
 * (`data`, `close`, `error`) rather than using the generic `EventProvider`:
 * a Transport is a typed stream, not a generic bus. The *transport package*
 * still receives its events via `Platform.events` internally; these methods
 * are the public stream surface for protocol consumers.
 */
export interface Transport {
    readonly id: string;
    readonly state: TransportState;
    write(data: Uint8Array): Promise<void>;
    read(): Promise<Uint8Array>;
    close(reason?: CloseReason): Promise<void>;
    on(event: "data", listener: (data: Uint8Array) => void): void;
    on(event: "close", listener: (reason: CloseReason) => void): void;
    on(event: "error", listener: (error: Error) => void): void;
    once(event: "data", listener: (data: Uint8Array) => void): void;
    once(event: "close", listener: (reason: CloseReason) => void): void;
    once(event: "error", listener: (error: Error) => void): void;
}

/**
 * `DatagramTransport` — the injected UDP datagram surface.
 *
 * Implemented by: `@browsercore/transport`
 *
 * Why here: QUIC consumes `DatagramTransport`. Like `Transport`, it is
 * obtained from `Platform.network.udp` and passed down through options —
 * protocol packages never bind to a runtime socket directly.
 */
export interface DatagramTransport {
    readonly id: string;
    send(data: Uint8Array, address: UdpAddress): Promise<void>;
    recv(): Promise<{ readonly data: Uint8Array; readonly from: UdpAddress }>;
    close(reason?: DatagramCloseReason): Promise<void>;
}

// ===========================================================================
// Protocol Connection Contracts
// ===========================================================================

/**
 * `TlsConnection` — the injected TLS connection surface.
 *
 * Implemented by: `@browsercore/tls`
 *
 * Why here: fetch consumes `TlsConnection`. The TLS package receives its
 * injected dependencies (transport, crypto, events) through `TlsOptions`,
 * which is populated from the `Platform` composition root.
 */
export interface TlsConnection {
    readonly id: string;
    readonly state: TlsState;
    handshake(): Promise<void>;
    read(): Promise<Uint8Array>;
    write(data: Uint8Array): Promise<void>;
    close(): Promise<void>;
}

/**
 * `Http1Connection` — the injected HTTP/1 connection surface.
 *
 * Implemented by: `@browsercore/http1`
 *
 * Why here: fetch consumes `Http1Connection`. The package receives its
 * injected transport and profile through `Http1Options`.
 */
export interface Http1Connection {
    readonly id: string;
    request(req: Request): Promise<Response>;
    close(): Promise<void>;
}

/**
 * `Http2Connection` — the injected HTTP/2 connection surface.
 *
 * Implemented by: `@browsercore/http2`
 *
 * Why here: fetch consumes `Http2Connection`. The package receives its
 * injected transport and profile through `Http2Options`.
 */
export interface Http2Connection {
    readonly id: string;
    request(req: Request): Promise<Response>;
    close(): Promise<void>;
    goaway(): Promise<void>;
}

/**
 * `Http3Connection` — the injected HTTP/3 connection surface.
 *
 * Implemented by: `@browsercore/http3`
 *
 * Why here: fetch consumes `Http3Connection`. Built on top of
 * `QuicConnection`; receives its injected QUIC transport through
 * `Http3Options`.
 */
export interface Http3Connection {
    readonly id: string;
    request(req: Request): Promise<Response>;
    close(): Promise<void>;
    goaway(streamId: bigint): Promise<void>;
}

/**
 * `QuicConnection` — the injected QUIC connection surface.
 *
 * Implemented by: `@browsercore/quic`
 *
 * Why here: HTTP/3 consumes `QuicConnection`. The package receives its
 * injected UDP transport and crypto through `QuicOptions`, populated from
 * `Platform`.
 */
export interface QuicConnection {
    readonly id: string;
    handshake(): Promise<void>;
    openBidirectionalStream(): Promise<QuicStream>;
    acceptBidirectionalStream(): Promise<QuicStream>;
    openUnidirectionalStream(): Promise<QuicStream>;
    acceptUnidirectionalStream(): Promise<QuicStream>;
    close(errorCode: bigint, reason: string): Promise<void>;
    sendPathChallenge(data: Uint8Array): void;
    hasPendingPathChallenge(data: Uint8Array): boolean;
}

/**
 * `QuicStream` — an injected QUIC stream handle.
 *
 * Why here: `QuicConnection` returns `QuicStream`; HTTP/3 uses it for
 * request multiplexing. Streams are owned by the QUIC package and carry no
 * direct runtime dependency.
 */
export interface QuicStream {
    readonly id: bigint;
    write(data: Uint8Array): Promise<void>;
    read(): Promise<Uint8Array>;
    close(): Promise<void>;
}

// ===========================================================================
// Client Contracts
// ===========================================================================

/**
 * `FetchClient` — the injected high-level fetch surface.
 *
 * Implemented by: `@browsercore/fetch`
 *
 * Why here: browsersmith consumes `FetchClient`. Assembled from the
 * protocol connections and injected services (`CookieJar`, transport, crypto)
 * via `FetchClientOptions`, which `browsersmith` populates from `Platform`.
 */
export interface FetchClient {
    fetch(url: string, options?: FetchOptions): Promise<FetchResponse>;
    close(): Promise<void>;
}

/**
 * `CookieJar` — the injected cookie storage surface.
 *
 * Implemented by: `@browsercore/cookies`
 *
 * Why here: fetch and browsersmith both use `CookieJar`. Provided via
 * `FetchClientOptions.cookieJar`, populated from `Platform` or a custom
 * implementation — never hardcoded to a runtime store.
 */
export interface CookieJar {
    getCookies(url: string): readonly Cookie[];
    setCookie(url: string, cookie: Cookie): void;
    clear(): void;
    serialize(): string;
    deserialize(data: string): void;
}

// ===========================================================================
// Cross-cutting Contracts
// ===========================================================================

// The canonical `Clock` lives in `time.ts` (with `monotonic()`) and is
// re-exported from the barrel. The options-level `Clock` shape consumed by
// protocol packages is imported directly from `time.ts` in `options.ts`; it
// needs only `now()`, which `time.ts` satisfies.

/**
 * `PacketCallback` — the injected packet-inspection surface.
 *
 * Why here: Protocol packages emit frames for inspection/debugging. The
 * callback is passed through options (never a global), so consumers like
 * browsersmith wire it up without coupling protocols to a tracing backend.
 */
export type PacketCallback = (frame: ProtocolFrame) => void;

/**
 * Options mixin that adds packet inspection.
 */
export interface PacketInspectionOptions {
    readonly onPacket?: PacketCallback;
}
