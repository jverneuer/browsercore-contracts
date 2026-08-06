/**
 * @browsercore/contracts — the public SDK surface for the browsercore stack.
 *
 * This package contains every type that defines how BrowserCore components
 * communicate with each other. It is implementation-independent: no node:crypto,
 * node:net, Buffer, curl, OpenSSL, ngtcp2, or any implementation details.
 *
 * Litmus test: "Could another package reasonably import this type?"
 * If yes → belongs here. If only one protocol touches it → stays in that package.
 *
 * Architecture:
 *
 *   @browsercore/contracts (this package)
 *           ▲
 *           │
 *    ┌──────┼─────────────┐
 *    │      │             │
 *    ▼      ▼             ▼
 *   tls    http2       transport
 *    │       │             │
 *    └───────┴─────────────┘
 *            ▼
 *      @browsercore/browsersmith
 */

// ===========================================================================
// Contracts — interfaces that define the API
// ===========================================================================

export type {
    // Provider contracts
    CryptoProvider,
    CompressionProvider,
    Transport,
    DatagramTransport,
    // Protocol connections
    TlsConnection,
    Http1Connection,
    Http2Connection,
    Http3Connection,
    QuicConnection,
    QuicStream,
    // Client contracts
    FetchClient,
    CookieJar,
    // Cross-cutting
    Logger,
    Clock,
    PacketCallback,
    PacketInspectionOptions,
} from "./contracts.js";

export { silentLogger } from "./contracts.js";

// ===========================================================================
// Models — shared data structures
// ===========================================================================

export type {
    // Identifiers
    ProfileId,
    // Browser profile
    BrowserProfile,
    TlsProfile,
    Http1Profile,
    Http2Profile,
    // HTTP messages
    Request,
    Response,
    FetchOptions,
    FetchResponse,
    // Headers
    Headers,
    // Cookies
    Cookie,
    // Crypto types
    HashId,
    EcdhCurve,
    X25519KeyPair,
    EcdhKeyPair,
    // Transport types
    UdpAddress,
    TransportState,
    CloseReason,
    DatagramCloseReason,
    TlsState,
    // Compression
    ContentEncoding,
} from "./models.js";

// IANA TLS parameter registries — canonical wire code tables.
export {
    CIPHER_GREASE_PLACEHOLDER,
    CIPHER_SUITE_CODES,
    NAMED_GROUP_CODES,
    SIGNATURE_SCHEME_CODES,
    VERSION_CODES,
} from "./models.js";

// ===========================================================================
// Options — configuration for protocol packages
// ===========================================================================

export type {
    TlsOptions,
    Http1Options,
    Http2Options,
    Http3Options,
    QuicOptions,
    FetchClientOptions,
} from "./options.js";
