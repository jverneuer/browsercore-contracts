/**
 * Contracts — interfaces that define how BrowserCore components communicate.
 *
 * Litmus test: "Could another package reasonably import this type?"
 * If yes → belongs here. If only one protocol touches it → stays in that package.
 */

import type {
    // From models
    BrowserProfile,
    Cookie,
    FetchOptions,
    FetchResponse,
    Headers,
    ProtocolFrame,
    Request,
    Response,
    UdpAddress,
} from "./models.js";

// ===========================================================================
// Provider Contracts (I/O boundary)
// ===========================================================================

/**
 * Cryptographic primitive abstraction.
 * Implemented by: @browsercore/crypto
 *
 * Why here: Every protocol package needs crypto operations.
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
 * Compression/decompression abstraction.
 * Implemented by: @browsercore/compression
 *
 * Why here: HTTP/1 and HTTP/2 both need compression.
 */
export interface CompressionProvider {
    encode(encoding: ContentEncoding, data: Uint8Array): Promise<Uint8Array>;
    decode(encoding: ContentEncoding, data: Uint8Array): Promise<Uint8Array>;
}

/**
 * Reliable ordered byte stream abstraction (TCP).
 * Implemented by: @browsercore/transport
 *
 * Why here: TLS, HTTP/1, HTTP/2 all consume Transport.
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
 * Datagram transport abstraction (UDP).
 * Implemented by: @browsercore/transport
 *
 * Why here: QUIC consumes DatagramTransport.
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
 * TLS connection abstraction.
 * Implemented by: @browsercore/tls
 *
 * Why here: fetch consumes TlsConnection.
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
 * HTTP/1 connection abstraction.
 * Implemented by: @browsercore/http1
 *
 * Why here: fetch consumes Http1Connection.
 */
export interface Http1Connection {
    readonly id: string;
    request(req: Request): Promise<Response>;
    close(): Promise<void>;
}

/**
 * HTTP/2 connection abstraction.
 * Implemented by: @browsercore/http2
 *
 * Why here: fetch consumes Http2Connection.
 */
export interface Http2Connection {
    readonly id: string;
    request(req: Request): Promise<Response>;
    close(): Promise<void>;
    goaway(): Promise<void>;
}

/**
 * HTTP/3 connection abstraction.
 * Implemented by: @browsercore/http3
 *
 * Why here: fetch consumes Http3Connection.
 */
export interface Http3Connection {
    readonly id: string;
    request(req: Request): Promise<Response>;
    close(): Promise<void>;
    goaway(streamId: bigint): Promise<void>;
}

/**
 * QUIC connection abstraction.
 * Implemented by: @browsercore/quic
 *
 * Why here: HTTP/3 consumes QuicConnection.
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
 * QUIC stream abstraction.
 *
 * Why here: QuicConnection returns QuicStream, HTTP/3 uses it.
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
 * High-level fetch client.
 * Implemented by: @browsercore/fetch
 *
 * Why here: browsersmith consumes FetchClient.
 */
export interface FetchClient {
    fetch(url: string, options?: FetchOptions): Promise<FetchResponse>;
    close(): Promise<void>;
}

/**
 * Cookie jar abstraction.
 * Implemented by: @browsercore/cookies
 *
 * Why here: fetch and browsersmith both use CookieJar.
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

/**
 * Time-source abstraction.
 * Injected for deterministic tests.
 *
 * Why here: Every protocol package needs time.
 */
export interface Clock {
    now(): number;
    setTimeout(callback: () => void, delayMs: number): () => void;
}

/**
 * Packet inspection callback.
 *
 * Why here: Protocol packages emit frames, consumers receive them.
 */
export type PacketCallback = (frame: ProtocolFrame) => void;

/**
 * Options mixin that adds packet inspection.
 */
export interface PacketInspectionOptions {
    readonly onPacket?: PacketCallback;
}

// ===========================================================================
// Shared Types (imported from models)
// ===========================================================================

import type { HashId, EcdhCurve, X25519KeyPair, EcdhKeyPair } from "./models.js";
import type { ContentEncoding } from "./models.js";
import type { TransportState, CloseReason, DatagramCloseReason, TlsState } from "./models.js";
