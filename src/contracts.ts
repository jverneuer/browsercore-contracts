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
    HashId,
    ProtocolFrame,
    TransportState,
    CloseReason,
    UdpAddress,
    X25519KeyPair,
    MLKEM768KeyPair,
} from "./models.js";
import type { EventProvider } from "./events.js";

// ===========================================================================
// Provider Contracts (I/O boundary)
// ===========================================================================

/**
 * `CryptoProvider` — the canonical injected cryptographic primitive surface.
 *
 * Canonical definition (replaceability audit 2026-11-16): this is the single
 * Transport/Crypto-level source of truth. `@browsercore/crypto` re-exports
 * this exact type; `HashId` is a plain union here while the branded
 * specializations (`Sha256Id`/`Sha384Id`, the `SHA_256`/`SHA_384` constants)
 * stay in `@browsercore/crypto` and remain assignable to these parameters in
 * both directions (verified by compile check).
 *
 * Implemented by: the composition root (`browsersmith`) assembles the
 * Node-backed provider from `@browsercore/crypto` building blocks and injects
 * it as `Platform.crypto.provider` — protocol packages (tls, quic, http2,
 * fetch) never import `node:crypto` or any runtime builtin directly.
 *
 * All operations are synchronous by design — an async-only backend such as
 * WebCrypto cannot implement this interface; it is NOT a valid backend.
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
    /**
     * Generate an ML-KEM-768 key pair (FIPS 203, formerly Kyber).
     *
     * The public key (encapsulation key) is sent in the TLS 1.3
     * `X25519MLKEM768` key-share entry; the secret key (decapsulation key)
     * is held locally to recover the shared secret from the peer's ciphertext.
     */
    mlkem768GenerateKeyPair(): MLKEM768KeyPair;
    /**
     * ML-KEM-768 decapsulation — recover the 32-byte shared secret from a
     * ciphertext produced by the peer's encapsulation.
     */
    mlkem768Decapsulate(secretKey: Uint8Array, ciphertext: Uint8Array): Uint8Array;
    /**
     * Compute the TLS 1.3 `X25519MLKEM768` hybrid shared secret.
     *
     * Per draft-ietf-tls-ecdhe-mlkem, the post-quantum and classical shared
     * secrets are concatenated — `mlkem_shared_secret || x25519_shared_secret`
     * (post-quantum first) — and the 64-byte result is fed into the TLS 1.3
     * key schedule. Order verified against OpenSSL's X25519MLKEM768 peer.
     */
    x25519MLKEM768SharedSecret(
        x25519SecretKey: Uint8Array,
        x25519PeerPublicKey: Uint8Array,
        mlkemSecretKey: Uint8Array,
        mlkemCiphertext: Uint8Array,
    ): Uint8Array;
}

/**
 * `CompressionProvider` — the canonical injected compression surface.
 *
 * Canonical definition (replaceability audit 2026-11-16): signature-identical
 * to `@browsercore/compression`'s local copy — verified method-by-method; this
 * interface is the single source of truth, the compression package keeps a
 * compatible re-export.
 *
 * Implemented by: the composition root (`browsersmith`) assembles the
 * node:zlib-backed provider and injects it as `Platform.compression` —
 * HTTP/1 and HTTP/2 receive it through options and never bind to `node:zlib`
 * directly.
 *
 * All operations are synchronous by design. An async-stream backend such as
 * WebCompressionStream cannot implement this interface — it is NOT a valid
 * backend (the former claim that it was has been corrected).
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
 * `Transport` — the canonical injected reliable byte stream (TCP).
 *
 * Canonical definition (replaceability audit 2026-11-16): this is the shape
 * `@browsercore/transport` implements and every protocol package consumes —
 * `@browsercore/transport` re-exports this exact type instead of declaring a
 * competing one. The former contracts-only variant (literal-event `on`/`once`
 * overloads plus a `bytesTransferred` counter on the open state) was
 * implemented by nobody and is gone.
 *
 * Implemented by: `@browsercore/transport`'s `TcpTransport` (via
 * `Platform.network.tcp` + `connect()`), and `@browsercore/proxy`'s
 * socket adapter for tunneled streams. Consumed by tls, http1, http2, fetch.
 *
 * Events: `on`/`once` are inherited from {@link EventProvider} — the broad
 * `(event: string, listener: (...args: unknown[]) => void)` surface every
 * implementation actually declares. Narrowing them to per-literal overloads
 * here would reject those implementations under strict checks (verified by
 * compile probe on this toolchain), so the typed 3-event overloads of the old
 * contracts variant are deliberately not preserved. Consumers subscribe to
 * `"data"`/`"close"`/`"error"` through the EventProvider surface.
 *
 * `id` is a plain string; the branded `TransportId` specialization lives in
 * `@browsercore/transport` and assigns to/from this field.
 */
export interface Transport extends EventProvider {
    /** Opaque identifier for logging / correlation. */
    readonly id: string;
    /** Current lifecycle state (see {@link TransportState}). */
    readonly state: TransportState;

    /**
     * Write bytes to the stream. Resolves when the data has been handed to the
     * kernel (or buffered). Rejects if the transport is not open.
     */
    write(data: Uint8Array): Promise<void>;

    /**
     * Read available data. Resolves with the next chunk of bytes, or rejects if
     * the transport closes before any data arrives. For a streaming read API,
     * subscribe to the `"data"` event instead.
     */
    read(): Promise<Uint8Array>;

    /**
     * Gracefully close the transport. Resolves once the stream has closed.
     * `reason` is recorded for observability.
     */
    close(reason?: CloseReason): Promise<void>;
}

/**
 * `DatagramTransport` — the canonical injected UDP datagram surface.
 *
 * Canonical definition (replaceability audit 2026-11-16): signature-identical
 * to `@browsercore/transport`'s local copy, which re-exports this one.
 *
 * Implemented by: the composition root's UDP adapter (`browsersmith`,
 * `Platform.network.udp`). Consumed by `@browsercore/quic`.
 */
export interface DatagramTransport {
    readonly id: string;
    send(data: Uint8Array, address: UdpAddress): Promise<void>;
    recv(): Promise<{ readonly data: Uint8Array; readonly from: UdpAddress }>;
    close(reason?: DatagramCloseReason): Promise<void>;
}

// ===========================================================================
// Client Contracts
// ===========================================================================

/**
 * `CookieJar` — the injected cookie storage surface.
 *
 * Implemented by: `@browsercore/cookies` (its local `CookieJar` is the shape
 * consumers actually bind; note its `setCookie` parameter order is
 * `(cookie, url)` — flipped relative to this interface. Reconciling the two
 * is tracked separately from the Transport/CryptoProvider unification.)
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
// re-exported from the barrel. The dead options layer that once re-declared
// a narrower `Clock` shape was removed with the rest of `options.ts`
// (replaceability audit 2026-11-16: zero consumers repo-wide).

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
