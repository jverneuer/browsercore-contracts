/**
 * @browsercore/contracts — the public SDK surface for the browsercore stack.
 *
 * This package contains every type that defines how BrowserCore components
 * communicate with each other. It is implementation-independent: no `node:crypto`,
 * `node:net`, `Buffer`, curl, OpenSSL, ngtcp2, or any runtime builtin.
 *
 * Litmus test: "Could another package reasonably import this type?"
 * If yes → belongs here. If only one protocol touches it → stays in that package.
 *
 * Architecture — every interface here is injected through `Platform`:
 *
 *   @browsercore/contracts (this package — defines the contracts)
 *           ▲
 *           │ (depend on, never import from)
 *    ┌──────┼─────────────┐
 *    │      │             │
 *    ▼      ▼             ▼
 *   tls    http2       transport
 *    │       │             │
 *    └───────┴─────────────┘
 *            ▼
 *   browsersmith (composition root — builds & threads Platform)
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
    PacketCallback,
    PacketInspectionOptions,
} from "./contracts.js";

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
    HpackProfile,
    Http2PriorityFrame,
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
    MLKEM768KeyPair,
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
// TcpTransport — platform-agnostic TCP + DNS contracts
// ===========================================================================

export type {
    ConnectOptions,
    Socket,
    Net,
    DnsResolver,
    IPAddress,
    Network,
} from "./tcp-transport.js";

// ===========================================================================
// Events — platform-agnostic event contracts
// ===========================================================================

export type {
    EventProvider,
    TypedEventEmitter,
} from "./events.js";

// ===========================================================================
// Telemetry — logging, tracing, metrics
// ===========================================================================

export type {
    Logger,
    Span,
    Tracer,
    Metrics,
    Telemetry,
} from "./telemetry.js";

// ===========================================================================
// Time — clock and scheduler
// ===========================================================================

export type {
    Clock,
    Deadline,
    Scheduler,
    Time,
} from "./time.js";

/** Duration static factories — `Duration.seconds(5)`, `Duration.milliseconds(250)`. */
export { Duration } from "./time.js";

// ===========================================================================
// Platform — composition root
// ===========================================================================

export type {
    Compression,
    Crypto,
    Platform,
    PlatformOptions,
} from "./platform.js";

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
