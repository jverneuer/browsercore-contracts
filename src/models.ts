/**
 * Models — shared data models that multiple packages agree on.
 *
 * Litmus test: "Could another package reasonably import this type?"
 * If yes → belongs here. If only one protocol touches it → stays in that package.
 */

// ===========================================================================
// Base Frame (for packet inspection)
// ===========================================================================

/** Direction of a protocol frame. */
export type PacketDirection = "sent" | "received";

/**
 * Base protocol frame — the common shape every frame variant extends.
 *
 * Protocol packages extend this with their specific fields.
 * Consumers inspect the `protocol` field to narrow the type.
 *
 * Why here: Packet inspection callback needs this shape.
 */
export interface ProtocolFrame {
    /** Protocol that emitted this frame. */
    readonly protocol: string;
    /** Whether this frame was sent or received. */
    readonly direction: PacketDirection;
    /** Timestamp (ms since epoch) when the frame was captured. */
    readonly timestamp: number;
}

// ===========================================================================
// Identifiers
// ===========================================================================

/** Branded profile identifier. */
export type ProfileId = string;

// ===========================================================================
// Browser Profile
// ===========================================================================

/**
 * Complete browser fingerprint definition.
 * Pure data — no protocol logic.
 *
 * Why here: browsersmith, fetch, tls, http1, http2 all use profiles.
 */
export interface BrowserProfile {
    readonly id: ProfileId;
    readonly name: string;
    readonly tls: TlsProfile;
    readonly http1?: Http1Profile;
    readonly http2?: Http2Profile;
}

/**
 * TLS fingerprint signals.
 */
export interface TlsProfile {
    readonly cipherSuites: readonly string[];
    readonly namedGroups: readonly string[];
    readonly signatureSchemes: readonly string[];
    readonly supportedVersions: readonly number[];
    readonly extensionOrder: readonly number[];
    readonly grease: boolean;
}

/**
 * HTTP/1 fingerprint signals.
 */
export interface Http1Profile {
    readonly userAgent: string;
    readonly headerOrder: readonly string[];
    readonly connectionSettings: ReadonlyMap<string, string>;
}

/**
 * HTTP/2 fingerprint signals.
 */
export interface Http2Profile {
    readonly settings: ReadonlyMap<string, number>;
    readonly headerOrder: readonly string[];
    readonly initialWindowSize: number;
    readonly maxFrameSize: number;
}

// ===========================================================================
// HTTP Messages (protocol-agnostic)
// ===========================================================================

/**
 * HTTP request — protocol-agnostic.
 *
 * Why here: fetch, http1, http2, http3 all handle requests.
 */
export interface Request {
    readonly method: string;
    readonly url: string;
    readonly headers: Headers;
    readonly body?: Uint8Array;
}

/**
 * HTTP response — protocol-agnostic.
 *
 * Why here: fetch, http1, http2, http3 all produce responses.
 */
export interface Response {
    readonly status: number;
    readonly statusText: string;
    readonly headers: Headers;
    readonly body: Uint8Array;
}

// ===========================================================================
// Fetch Types
// ===========================================================================

/**
 * Fetch request options.
 *
 * Why here: fetch and browsersmith both use these options.
 */
export interface FetchOptions {
    readonly method?: string;
    readonly headers?: Headers;
    readonly body?: Uint8Array;
    readonly redirect?: "follow" | "manual" | "error";
    readonly signal?: AbortSignal;
}

/**
 * High-level fetch response with convenience methods.
 *
 * Why here: browsersmith and fetch both use this.
 */
export interface FetchResponse {
    readonly status: number;
    readonly statusText: string;
    readonly headers: Headers;
    readonly body: Uint8Array;
    json(): Promise<unknown>;
    text(): Promise<string>;
}

// ===========================================================================
// Headers
// ===========================================================================

/**
 * HTTP headers — a case-insensitive multimap.
 *
 * Why here: Every HTTP protocol package uses headers.
 */
export interface Headers {
    get(name: string): string | undefined;
    set(name: string, value: string): void;
    delete(name: string): void;
    has(name: string): boolean;
    entries(): IterableIterator<[string, string]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<string>;
    [Symbol.iterator](): IterableIterator<[string, string]>;
}

// ===========================================================================
// Cookies
// ===========================================================================

/**
 * HTTP cookie (RFC 6265).
 *
 * Why here: cookies, fetch, browsersmith all use cookies.
 */
export interface Cookie {
    readonly name: string;
    readonly value: string;
    readonly domain?: string;
    readonly path?: string;
    readonly expires?: number;
    readonly maxAge?: number;
    readonly secure?: boolean;
    readonly httpOnly?: boolean;
    readonly sameSite?: "Strict" | "Lax" | "None";
}

// ===========================================================================
// Crypto Types
// ===========================================================================

export type HashId = "SHA-256" | "SHA-384";
export type EcdhCurve = "secp256r1" | "secp384r1";

export interface X25519KeyPair {
    readonly publicKey: Uint8Array;
    readonly secretKey: Uint8Array;
}

export interface EcdhKeyPair {
    readonly curve: EcdhCurve;
    readonly publicKey: Uint8Array;
    readonly secretKey: Uint8Array;
}

// ===========================================================================
// Transport Types
// ===========================================================================

export interface UdpAddress {
    readonly address: string;
    readonly port: number;
    readonly family: 4 | 6;
}

export type TransportState =
    | { readonly state: "connecting" }
    | { readonly state: "open"; readonly bytesTransferred: number }
    | { readonly state: "closing" }
    | { readonly state: "closed"; readonly reason: CloseReason };

export type CloseReason =
    | { readonly kind: "client_close" }
    | { readonly kind: "remote_close" }
    | { readonly kind: "error"; readonly error: Error }
    | { readonly kind: "timeout"; readonly afterMs: number };

export type DatagramCloseReason =
    | { readonly kind: "client_close" }
    | { readonly kind: "remote_close" }
    | { readonly kind: "error"; readonly error: Error }
    | { readonly kind: "timeout"; readonly afterMs: number };

export type TlsState =
    | { readonly state: "connecting" }
    | { readonly state: "handshaking" }
    | { readonly state: "open" }
    | { readonly state: "closed"; readonly reason: CloseReason };

// ===========================================================================
// Compression Types
// ===========================================================================

export type ContentEncoding = "gzip" | "deflate" | "br" | "identity";

// ===========================================================================
// IANA TLS Parameter Registries — canonical wire code tables
// ===========================================================================
//
// Single source of truth for TLS protocol wire codes. Both @browsercore/tls
// and @browsercore/profiles import from here.

/** The name Chrome/Edge use in their cipher list to mark a GREASE slot (RFC 8701). */
export const CIPHER_GREASE_PLACEHOLDER = "TLS_GREASE_RESERVED_0";

/**
 * Selected IANA TLS Cipher Suite codes, keyed by canonical suite name.
 * @see https://www.iana.org/assignments/tls-parameters/tls-parameters-4
 */
export const CIPHER_SUITE_CODES: Readonly<Record<string, number>> = {
    [CIPHER_GREASE_PLACEHOLDER]: 0x0a0a,
    TLS_AES_128_GCM_SHA256: 0x1301,
    TLS_AES_256_GCM_SHA384: 0x1302,
    TLS_CHACHA20_POLY1305_SHA256: 0x1303,
    TLS_AES_128_CCM_SHA256: 0x1304,
    TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256: 0xc02b,
    TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256: 0xc02f,
    TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384: 0xc02c,
    TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384: 0xc030,
    TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256: 0xcca9,
    TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256: 0xcca8,
    TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA: 0xc013,
    TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA: 0xc014,
    TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA: 0xc009,
    TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA: 0xc00a,
    TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256: 0xc023,
    TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384: 0xc024,
    TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256: 0xc027,
    TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384: 0xc028,
    TLS_RSA_WITH_AES_128_GCM_SHA256: 0x009c,
    TLS_RSA_WITH_AES_256_GCM_SHA384: 0x009d,
    TLS_RSA_WITH_AES_128_CBC_SHA: 0x002f,
    TLS_RSA_WITH_AES_256_CBC_SHA: 0x0035,
    TLS_RSA_WITH_AES_128_CBC_SHA256: 0x003c,
    TLS_RSA_WITH_AES_256_CBC_SHA256: 0x003d,
    TLS_ECDHE_ECDSA_WITH_3DES_EDE_CBC_SHA: 0xc008,
    TLS_ECDHE_RSA_WITH_3DES_EDE_CBC_SHA: 0xc012,
    TLS_RSA_WITH_3DES_EDE_CBC_SHA: 0x000a,
};

/**
 * Selected IANA TLS Supported Groups (named groups) codes.
 * @see https://www.iana.org/assignments/tls-parameters/tls-parameters-8
 */
export const NAMED_GROUP_CODES: Readonly<Record<string, number>> = {
    x25519: 0x001d,
    x448: 0x001e,
    secp256r1: 0x0017,
    secp384r1: 0x0018,
    secp521r1: 0x0019,
    ffdhe2048: 0x0100,
    ffdhe3072: 0x0101,
    X25519Kyber768: 0x6399,
    X25519MLKEM768: 0x11ec,
};

/**
 * Selected IANA TLS Signature Scheme codes.
 * @see https://www.iana.org/assignments/tls-parameters/tls-parameters-16
 */
export const SIGNATURE_SCHEME_CODES: Readonly<Record<string, number>> = {
    ecdsa_secp256r1_sha256: 0x0403,
    ecdsa_secp384r1_sha384: 0x0503,
    ecdsa_secp521r1_sha512: 0x0603,
    ecdsa_sha1: 0x0203,
    rsa_pss_rsae_sha256: 0x0804,
    rsa_pss_rsae_sha384: 0x0805,
    rsa_pss_rsae_sha512: 0x0806,
    rsa_pkcs1_sha256: 0x0401,
    rsa_pkcs1_sha384: 0x0501,
    rsa_pkcs1_sha512: 0x0601,
    rsa_pkcs1_sha1: 0x0201,
    ed25519: 0x0807,
};

/** IANA TLS ProtocolVersion codes for the supported_versions extension. */
export const VERSION_CODES: Readonly<Record<string, number>> = {
    "TLS 1.3": 0x0304,
    "TLS 1.2": 0x0303,
    "TLS 1.1": 0x0302,
    "TLS 1.0": 0x0301,
};
