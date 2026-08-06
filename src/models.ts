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
