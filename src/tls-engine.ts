/**
 * TLS handshake engine contracts — the seam that lets QUIC drive a TLS
 * handshake without importing `@browsercore/tls`.
 *
 * Why this module exists (replaceability audit 2026-11-16, remediation
 * item #2): `@browsercore/quic` RUNTIME-EMBEDS the tls handshake engine —
 * `runHandshake` / `generateKeyShares` / `cipherSuiteToAead` plus twelve
 * types imported directly from `@browsercore/tls`
 * (`quic/src/handshake/quic-handshake.ts`) — the one true protocol→protocol
 * engine coupling in the stack, and the only violation of the no-hard-wires
 * invariant ("protocol packages must never import each other directly; all
 * inter-package communication flows through Platform interfaces defined in
 * @browsercore/contracts").
 *
 * The fix shape: `@browsercore/tls` implements
 * {@link TlsHandshakeEngine} and the composition root (browsersmith) injects
 * it into quic via options, exactly like crypto/transport/events — quic
 * consumes this interface, never the tls package directly. The pattern is
 * already proven end-to-end by http3's fake-quic compatibility test
 * (`http3/tests/fake-quic.ts`): a local structural implementation satisfying
 * the consumer's contract is the sanctioned way to swap an engine.
 *
 * Shape derivation: every operation and type below is exactly what quic
 * CALLS and the data it passes/receives on the real code path
 * (`quic-handshake.ts` imports `runHandshake`, `generateKeyShares`,
 * `cipherSuiteToAead` and the types `AeadAlgorithm`, `CipherSuite`,
 * `ClientHelloConfig`, `ServerHello`, `Certificate`, `TrafficSecrets`,
 * `HandshakeContext`, `HandshakePhase`, `AlertLevel`; `KeyPair` and
 * `ApplicationTrafficSecrets` ride along as the callback/return data).
 * Division of labor: quic implements the context itself (its
 * `QuicHandshakeContext` — the consumer-side SPI), so
 * {@link TlsHandshakeContext} here describes only the structural data
 * surface the engine reads and mutates; the engine implements
 * {@link TlsHandshakeEngine}. `HandshakeContext` AS A TYPE stays
 * consumer-side (quic's class keeps implementing it structurally); nothing
 * here is a class or carries runtime behavior.
 *
 * All shapes are pure data / function signatures — no runtime, no node:*.
 */

import type { CryptoProvider, Transport } from "./contracts.js";
import type { HashId } from "./models.js";

// ===========================================================================
// Canonical TLS wire-level types
// ===========================================================================
//
// Single definitions (0.2.6) mirroring @browsercore/tls's published shapes
// verbatim — next wave, tls aliases these (the same rename-free adoption
// transport/crypto performed for Transport/CryptoProvider in 0.2.5) and quic
// imports them from here instead of from tls. Names deliberately match tls's
// exports so the alias is a pure re-export.

/** TLS 1.3 AEAD algorithms used by record protection (TLS 1.3 only negotiates these four). */
export type AeadAlgorithm =
    | "AES-128-GCM"
    | "AES-256-GCM"
    | "AES-128-CCM"
    | "CHACHA20-POLY1305";

/**
 * A TLS cipher suite: string-literal union, never bare string.
 *
 * Covers every suite the shipped browser profiles OFFER (the four TLS 1.3
 * AEAD suites plus the TLS 1.2 suites and GREASE placeholder real browsers
 * place in the offered list); the NEGOTIATED suite is always one of the four
 * AEAD suites. Keyed by the same canonical names as
 * {@link ../models.js~CIPHER_SUITE_CODES}.
 */
export type CipherSuite =
    | "TLS_GREASE_RESERVED_0"
    | "TLS_AES_128_GCM_SHA256"
    | "TLS_AES_256_GCM_SHA384"
    | "TLS_CHACHA20_POLY1305_SHA256"
    | "TLS_AES_128_CCM_SHA256"
    | "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256"
    | "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"
    | "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384"
    | "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384"
    | "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256"
    | "TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256"
    | "TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA"
    | "TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA"
    | "TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA"
    | "TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA"
    | "TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256"
    | "TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384"
    | "TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256"
    | "TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384"
    | "TLS_RSA_WITH_AES_128_GCM_SHA256"
    | "TLS_RSA_WITH_AES_256_GCM_SHA384"
    | "TLS_RSA_WITH_AES_128_CBC_SHA"
    | "TLS_RSA_WITH_AES_256_CBC_SHA"
    | "TLS_RSA_WITH_AES_128_CBC_SHA256"
    | "TLS_RSA_WITH_AES_256_CBC_SHA256"
    | "TLS_ECDHE_ECDSA_WITH_3DES_EDE_CBC_SHA"
    | "TLS_ECDHE_RSA_WITH_3DES_EDE_CBC_SHA"
    | "TLS_RSA_WITH_3DES_EDE_CBC_SHA";

/** Named groups for key exchange (ECDHE / hybrid PQ), IANA canonical names. */
export type NamedGroup =
    | "secp256r1"
    | "secp384r1"
    | "secp521r1"
    | "x25519"
    | "x448"
    | "ffdhe2048"
    | "ffdhe3072"
    | "X25519MLKEM768"
    | "X25519Kyber768";

/** Signature algorithms accepted in CertificateVerify (IANA canonical names). */
export type SignatureScheme =
    | "ecdsa_secp256r1_sha256"
    | "ecdsa_secp384r1_sha384"
    | "ecdsa_secp521r1_sha512"
    | "ecdsa_sha1"
    | "ed25519"
    | "rsa_pss_rsae_sha256"
    | "rsa_pss_rsae_sha384"
    | "rsa_pss_rsae_sha512"
    | "rsa_pkcs1_sha256"
    | "rsa_pkcs1_sha384"
    | "rsa_pkcs1_sha512"
    | "rsa_pkcs1_sha1";

/**
 * A TLS protocol version — name plus IANA wire code as a discriminated pair
 * (the wire code is what the supported_versions extension carries).
 */
export type ProtocolVersion =
    | { readonly name: "TLS 1.2"; readonly wire: 0x0303 }
    | { readonly name: "TLS 1.3"; readonly wire: 0x0304 };

// ===========================================================================
// Handshake data shapes (pure data crossing the quic ↔ tls seam)
// ===========================================================================

/**
 * ClientHello configuration — the fingerprint-driven offer.
 *
 * Pure data: the offered cipher suites, exact extension order, GREASE flag,
 * key-share groups, signature algorithms, supported versions, SNI, and ALPN.
 * Higher layers (fetch) translate a `BrowserProfile` into this shape. quic's
 * options surface keeps its own wider `ClientHelloConfigLike` mirror
 * (plain-string lists) and converts to this typed shape at the engine call.
 */
export interface ClientHelloConfig {
    /** Ordered list of cipher suites the client advertises (most-preferred first). */
    readonly cipherSuites: readonly CipherSuite[];
    /**
     * Extension types in the exact order they must appear in the ClientHello.
     * Every type present here is emitted; anything absent is omitted. This is
     * the primary fingerprinting signal, so the order is load-bearing.
     */
    readonly extensionOrder: readonly number[];
    /** Named groups for key share, ordered by preference. */
    readonly keyShareGroups: readonly NamedGroup[];
    /**
     * Named groups ADVERTISED in supported_groups when the advertised set
     * differs from the groups actually shared in key_share (real Chrome
     * advertises a wider set than it key-shares). When omitted,
     * supported_groups is derived from {@link keyShareGroups}.
     */
    readonly supportedGroups?: readonly NamedGroup[];
    /** Signature algorithms the client accepts in CertificateVerify. */
    readonly signatureAlgorithms: readonly SignatureScheme[];
    /** Protocol versions the client advertises via supported_versions. */
    readonly supportedVersions: readonly ProtocolVersion[];
    /** Server Name Indication hostname (SNI). */
    readonly serverName: string;
    /** ALPN protocols the client wishes to negotiate (e.g. "h2", "h3"). */
    readonly alpnProtocols?: readonly string[];
    /** Whether to inject GREASE (RFC 8701) sentinel values. */
    readonly grease: boolean;
    /**
     * EC point formats offered in the `ec_point_formats` extension (wire byte
     * values). Omit for the default (uncompressed only).
     */
    readonly ecPointFormats?: readonly number[];
    /**
     * Algorithm IDs offered in the `compress_certificate` extension
     * (RFC 8879), as 16-bit IANA wire values. Omit for the default `[2]`
     * (brotli).
     */
    readonly compressCertificateAlgorithms?: readonly number[];
    /**
     * Target ClientHello message length in bytes for the PADDING extension
     * (RFC 7685). Omit to disable padding.
     */
    readonly recordPadding?: number;
}

/** A parsed ServerHello — the first handshake message the server sends. */
export interface ServerHello {
    /**
     * Legacy protocol version (always 0x0303 in TLS 1.3, for middlebox
     * compatibility). The real negotiated version is {@link selectedVersion}.
     */
    readonly protocolVersion: number;
    readonly random: Uint8Array;
    readonly sessionId: Uint8Array;
    readonly cipherSuite: CipherSuite;
    readonly compressionMethod: number;
    /**
     * The protocol version the server actually negotiated, from the
     * supported_versions extension. This is the authoritative version.
     */
    readonly selectedVersion: ProtocolVersion;
    /** Raw, undecoded ServerHello extensions bytes. */
    readonly extensions: Uint8Array;
}

/**
 * A parsed X.509 certificate (validation-relevant fields only) — pure data.
 * The engine writes the validated leaf into the context's `peerCertificate`.
 */
export interface Certificate {
    /** DER-encoded TBSCertificate bytes, needed for signature verification. */
    readonly tbsBytes: Uint8Array;
    /** DER-encoded SubjectPublicKeyInfo. */
    readonly subjectPublicKeyInfo: Uint8Array;
    /** Subject alternative DNS names (from the SAN extension), if any. */
    readonly subjectAltNames: readonly string[];
    /** Common Name from the subject DN, if present (legacy hostname match). */
    readonly commonName?: string;
    /** Not-before timestamp (epoch seconds). */
    readonly notBefore: number;
    /** Not-after timestamp (epoch seconds). */
    readonly notAfter: number;
    /** True if the certificate has the keyUsage bit for digital signature. */
    readonly keyUsageDigitalSignature: boolean;
    /** True if the certificate has the keyUsage bit for key encipherment/agreement. */
    readonly keyUsageKeyEncipherment: boolean;
    /** Signature algorithm used by the issuer over the TBSCertificate. */
    readonly signatureScheme: SignatureScheme;
    /** Raw signature value from the issuer. */
    readonly signatureValue: Uint8Array;
    /** DER-encoded SubjectPublicKeyInfo of the issuer (for chain building). */
    readonly issuer: string;
    /** True for a CA certificate. */
    readonly isCa: boolean;
}

/**
 * A key share for one named group — the data `generateKeyShares` returns.
 * `privateKey` is opaque to the consumer; the engine consumes it during the
 * handshake.
 */
export interface KeyPair {
    readonly algorithm: NamedGroup;
    /** Private key bytes (opaque to the consumer of the engine). */
    readonly privateKey: Uint8Array;
    /** Public key bytes, as they appear in a KeyShareEntry. */
    readonly publicKey: Uint8Array;
}

/** Traffic secrets derived by the TLS 1.3 key schedule for one direction. */
export interface TrafficSecrets {
    /** AEAD key for this direction. */
    readonly key: Uint8Array;
    /** AEAD IV (often called "write_iv") for this direction. */
    readonly iv: Uint8Array;
}

/** Full set of application traffic secrets for both directions after the handshake. */
export interface ApplicationTrafficSecrets {
    readonly client: TrafficSecrets;
    readonly server: TrafficSecrets;
}

/**
 * The handshake phase at which the engine currently is — granular enough
 * that a timeout or error names exactly which step was in progress. The
 * consumer exposes it as `currentPhase` on the context for error attribution.
 */
export type HandshakePhase =
    | "init"
    | "client_hello"
    | "server_hello"
    | "key_exchange"
    | "encrypted_extensions"
    | "certificate"
    | "certificate_verify"
    | "finished"
    | "client_finished"
    | "application";

/** Alert level of a TLS alert, per RFC 8446 §6. */
export type AlertLevel = "warning" | "fatal";

// ===========================================================================
// TlsHandshakeContext — the consumer-side SPI (implemented by quic)
// ===========================================================================

/**
 * `TlsHandshakeContext` — the slice of consumer state the handshake engine
 * reads and mutates while driving a handshake to completion.
 *
 * Implemented by the CONSUMER: quic's `QuicHandshakeContext` satisfies this
 * structurally today (against tls's local `HandshakeContext`, whose shape is
 * identical where it matters), which is why the fields are mutable — the
 * engine mutates the context's negotiated parameters and secrets in place,
 * and the consumer reads them after `runHandshake` resolves (quic then
 * derives its QUIC packet-protection keys from the intermediate secrets).
 * The full tls-local `HandshakeContext` type stays consumer/implementer-side;
 * this is the contract-level structural description of the same surface.
 *
 * The `compression` field is deliberately the structural slice
 * `{ brotliDecompress }` (RFC 8879 CompressedCertificate) rather than
 * {@link CompressionProvider}: quic already declares it that way
 * structurally, and it keeps this module decoupled from the compression
 * contract. QUIC never advertises compress_certificate, so quic's value is
 * always `undefined`.
 */
export interface TlsHandshakeContext {
    /** The byte-stream transport the handshake runs over (e.g. QUIC stream 0). */
    readonly transport: Transport;
    /** Cryptographic provider, injected by the consumer (no default). */
    crypto: CryptoProvider;
    /**
     * Brotli decompression for RFC 8879 CompressedCertificate (type 25).
     * `undefined` when the consumer did not advertise compress_certificate —
     * the server must then never send a compressed certificate.
     */
    compression: { brotliDecompress(data: Uint8Array): Uint8Array } | undefined;
    /** Mutable: buffered bytes not yet consumed by the record framer. */
    readBuffer: Uint8Array;
    /** Mutable: running transcript of full handshake messages. */
    readonly transcript: Uint8Array[];
    /** Mutable: negotiated cipher suite plus the derived AEAD and hash. */
    cipherSuite: CipherSuite;
    aead: AeadAlgorithm;
    hash: HashId;
    /** Mutable: parsed ServerHello, set when it arrives. */
    serverHello: ServerHello;
    /** Mutable: handshake traffic secrets (per direction) and the raw secrets. */
    clientHsTraffic: TrafficSecrets;
    serverHsTraffic: TrafficSecrets;
    clientHsTrafficSecret: Uint8Array;
    serverHsTrafficSecret: Uint8Array;
    masterSecret: Uint8Array;
    /**
     * Mutable: raw application traffic secrets, set when the engine derives
     * them. Retained so the consumer can rotate keys on KeyUpdate
     * (RFC 8446 §4.6.3) — and so quic can derive its 1-RTT keys.
     */
    clientAppSecret: Uint8Array;
    serverAppSecret: Uint8Array;
    /** Mutable: handshake-direction record sequence counters. */
    clientHsSeq: number;
    serverHsSeq: number;
    /** True once the handshake traffic secrets have been derived (sendAlert gate). */
    hsTrafficReady: boolean;
    /** Set when the server negotiates ALPN in EncryptedExtensions. */
    alpnProtocol?: string | undefined;
    /** Set to the validated leaf once the Certificate message is consumed. */
    peerCertificate?: Certificate | undefined;
    /** Mutable: the handshake phase currently in progress (error attribution). */
    currentPhase: HandshakePhase;
    /** Optional debug trace callback — one line before/after each I/O and crypto step. */
    onDebug: ((msg: string) => void) | undefined;
    /**
     * Send a TLS alert (RFC 8446 §6) to the peer. Best-effort. QUIC signals
     * transport-level errors via CONNECTION_CLOSE (RFC 9001 §4.8), so its
     * implementation is a no-op — the hook exists for TLS-over-TCP consumers.
     */
    sendAlert(level: AlertLevel, description: number): Promise<void>;
}

// ===========================================================================
// TlsHandshakeEngine — the engine contract (implemented by @browsercore/tls)
// ===========================================================================

/**
 * `TlsHandshakeEngine` — the injected TLS 1.3 handshake engine.
 *
 * Implemented by `@browsercore/tls` (wired at the composition root into
 * quic's options); quic consumes this, never the tls package directly
 * (no-hard-wires invariant). Each operation below is exactly the function
 * quic's handshake orchestration calls on `@browsercore/tls` today —
 * signatures lifted verbatim so the tls implementation satisfies this
 * interface without adaptation.
 */
export interface TlsHandshakeEngine {
    /**
     * Drive the TLS 1.3 handshake to completion against `ctx`.
     *
     * The engine mutates the context's negotiated parameters and secrets
     * (including the INTERMEDIATE handshake secrets quic needs for its key
     * phases) and resolves with the final application traffic secrets.
     *
     * @param ctx              Consumer-implemented state (see {@link TlsHandshakeContext}).
     * @param config           ClientHello configuration (the fingerprint offer).
     * @param serverName       SNI hostname (for SNI + certificate validation).
     * @param trustAnchors     Trust anchors (PEM/DER) for certificate validation.
     * @param generateKeyShares Key-share generator — `(groups) => Promise<KeyPair[]>`;
     *                          the consumer injects its crypto provider here
     *                          (quic: `(groups) => engine.generateKeyShares(groups, crypto)`).
     * @param now              Current epoch SECONDS (injected so cert validation stays deterministic).
     */
    runHandshake(
        ctx: TlsHandshakeContext,
        config: ClientHelloConfig,
        serverName: string,
        trustAnchors: readonly Uint8Array[],
        generateKeyShares: (groups: readonly string[]) => Promise<KeyPair[]>,
        now: number,
    ): Promise<ApplicationTrafficSecrets>;

    /**
     * Generate key shares for the requested groups (all offered groups,
     * including post-quantum hybrids). Delegates to the injected crypto
     * provider; quic wraps this into its `runHandshake` callback.
     */
    generateKeyShares(groups: readonly string[], crypto: CryptoProvider): Promise<KeyPair[]>;

    /** Map a TLS cipher suite to its AEAD algorithm (exhaustive over TLS 1.3 suites). */
    cipherSuiteToAead(cipherSuite: CipherSuite): AeadAlgorithm;
}
