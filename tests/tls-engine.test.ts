/**
 * Tests for the TLS handshake engine contracts (src/tls-engine.ts, 0.2.6).
 *
 * Everything in the module is TypeScript-only (interfaces + literal-union
 * types), so these tests verify structural conformance the same way
 * platform.test.ts does: mock implementations that satisfy the interfaces —
 * if a mock fails to conform, the assignment fails to compile. The context
 * mock deliberately mirrors quic's `QuicHandshakeContext` field-for-field
 * (the real consumer implementation), and the engine mock mirrors
 * @browsercore/tls's three exported operations.
 */

import { describe, it, expect, vi } from "vitest";
import type {
    AeadAlgorithm,
    AlertLevel,
    ApplicationTrafficSecrets,
    Certificate,
    CipherSuite,
    ClientHelloConfig,
    HandshakePhase,
    KeyPair,
    ProtocolVersion,
    ServerHello,
    TlsHandshakeContext,
    TlsHandshakeEngine,
    TrafficSecrets,
} from "../src/tls-engine.js";
import type { CryptoProvider, Transport } from "../src/contracts.js";
import type { EcdhCurve, EcdhKeyPair, HashId, MLKEM768KeyPair, X25519KeyPair } from "../src/models.js";
// Compile-time check: the engine seam is part of the public SDK surface.
import type {
    TlsHandshakeEngine as PublicTlsHandshakeEngine,
    TlsHandshakeContext as PublicTlsHandshakeContext,
} from "../src/index.js";

// ===========================================================================
// Mock builders
// ===========================================================================

/** Minimal CryptoProvider mock — every method returns zero-filled output. */
function createMockCryptoProvider(): CryptoProvider {
    const bytes = (n: number): Uint8Array => new Uint8Array(n);
    const pair = (len: number): X25519KeyPair => ({ publicKey: bytes(len), secretKey: bytes(len) });
    const ecdh = (curve: EcdhCurve): EcdhKeyPair => ({
        curve,
        publicKey: bytes(32),
        secretKey: bytes(32),
    });
    const kem: MLKEM768KeyPair = { publicKey: bytes(1184), secretKey: bytes(2400) };
    return {
        randomBytes: bytes,
        sha256: (data: Uint8Array): Uint8Array => bytes(data.length),
        sha384: (data: Uint8Array): Uint8Array => bytes(data.length),
        hkdf: (_h: HashId, _s: Uint8Array, _i: Uint8Array, _inf: Uint8Array, length: number) => bytes(length),
        hmac: (_h: HashId, _k: Uint8Array, data: Uint8Array) => bytes(data.length),
        aes128GcmEncrypt: (_k: Uint8Array, _n: Uint8Array, p: Uint8Array, _a: Uint8Array) => bytes(p.length),
        aes128GcmDecrypt: (_k: Uint8Array, _n: Uint8Array, c: Uint8Array, _a: Uint8Array) => bytes(c.length),
        aes256GcmEncrypt: (_k: Uint8Array, _n: Uint8Array, p: Uint8Array, _a: Uint8Array) => bytes(p.length),
        aes256GcmDecrypt: (_k: Uint8Array, _n: Uint8Array, c: Uint8Array, _a: Uint8Array) => bytes(c.length),
        aes128CcmEncrypt: (_k: Uint8Array, _n: Uint8Array, p: Uint8Array, _a: Uint8Array) => bytes(p.length),
        aes128CcmDecrypt: (_k: Uint8Array, _n: Uint8Array, c: Uint8Array, _a: Uint8Array) => bytes(c.length),
        chacha20Poly1305Encrypt: (_k: Uint8Array, _n: Uint8Array, p: Uint8Array, _a: Uint8Array) => bytes(p.length),
        chacha20Poly1305Decrypt: (_k: Uint8Array, _n: Uint8Array, c: Uint8Array, _a: Uint8Array) => bytes(c.length),
        x25519GenerateKeyPair: () => pair(32),
        x25519SharedSecret: () => bytes(32),
        ecdhGenerateKeyPair: ecdh,
        ecdhSharedSecret: (curve: EcdhCurve) => bytes(curve === "secp256r1" ? 32 : 48),
        verifySignature: () => true,
        aesEcbEncrypt: (_k: Uint8Array, block: Uint8Array) => bytes(block.length),
        mlkem768GenerateKeyPair: () => kem,
        mlkem768Decapsulate: () => bytes(32),
        x25519MLKEM768SharedSecret: () => bytes(64),
    };
}

/** Minimal Transport mock (the handshake's byte-stream carrier). */
function createMockTransport(): Transport {
    return {
        id: "mock-stream-0",
        state: { state: "open" },
        write: vi.fn().mockResolvedValue(undefined),
        read: vi.fn().mockResolvedValue(new Uint8Array(0)),
        close: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        removeListener: vi.fn(),
        emit: vi.fn().mockReturnValue(true),
        listenerCount: vi.fn().mockReturnValue(0),
        removeAllListeners: vi.fn(),
    };
}

/**
 * A consumer-side context mock mirroring quic's `QuicHandshakeContext`
 * field-for-field — QUIC never advertises compress_certificate, so
 * `compression` stays undefined; sendAlert is a no-op (QUIC signals errors
 * via CONNECTION_CLOSE).
 */
function createMockContext(): TlsHandshakeContext {
    return {
        transport: createMockTransport(),
        crypto: createMockCryptoProvider(),
        compression: undefined,
        readBuffer: new Uint8Array(0),
        transcript: [],
        cipherSuite: "TLS_AES_128_GCM_SHA256",
        aead: "AES-128-GCM",
        hash: "SHA-256",
        serverHello: undefined as unknown as ServerHello,
        clientHsTraffic: { key: new Uint8Array(16), iv: new Uint8Array(12) },
        serverHsTraffic: { key: new Uint8Array(16), iv: new Uint8Array(12) },
        clientHsTrafficSecret: new Uint8Array(32),
        serverHsTrafficSecret: new Uint8Array(32),
        masterSecret: new Uint8Array(32),
        clientAppSecret: new Uint8Array(0),
        serverAppSecret: new Uint8Array(0),
        clientHsSeq: 0,
        serverHsSeq: 0,
        hsTrafficReady: false,
        alpnProtocol: undefined,
        peerCertificate: undefined,
        currentPhase: "init",
        onDebug: undefined,
        sendAlert: vi.fn().mockResolvedValue(undefined),
    };
}

/** A TLS 1.3, Chrome-shaped ClientHello config exercising the typed unions. */
const config: ClientHelloConfig = {
    cipherSuites: ["TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384"],
    extensionOrder: [51, 43, 45],
    keyShareGroups: ["X25519MLKEM768", "x25519"],
    signatureAlgorithms: ["rsa_pss_rsae_sha256", "ecdsa_secp256r1_sha256"],
    supportedVersions: [{ name: "TLS 1.3", wire: 0x0304 }],
    serverName: "example.com",
    alpnProtocols: ["h3"],
    grease: true,
};

/** The tls operation set, mocked: runHandshake / generateKeyShares / cipherSuiteToAead. */
function createMockEngine(): TlsHandshakeEngine {
    const secrets: ApplicationTrafficSecrets = {
        client: { key: new Uint8Array(16), iv: new Uint8Array(12) },
        server: { key: new Uint8Array(16), iv: new Uint8Array(12) },
    };
    return {
        runHandshake: vi.fn().mockImplementation(async (ctx: TlsHandshakeContext) => {
            ctx.currentPhase = "application";
            ctx.hsTrafficReady = true;
            ctx.alpnProtocol = "h3";
            return secrets;
        }),
        generateKeyShares: vi.fn().mockImplementation(async (groups: readonly string[]) =>
            groups.map((group): KeyPair => ({
                algorithm: group as KeyPair["algorithm"],
                privateKey: new Uint8Array(32),
                publicKey: new Uint8Array(32),
            })),
        ),
        // The exhaustive tls mapping (the only suites TLS 1.3 can negotiate).
        cipherSuiteToAead: (cipherSuite: CipherSuite): AeadAlgorithm => {
            switch (cipherSuite) {
                case "TLS_AES_128_GCM_SHA256":
                    return "AES-128-GCM";
                case "TLS_AES_128_CCM_SHA256":
                    return "AES-128-CCM";
                case "TLS_AES_256_GCM_SHA384":
                    return "AES-256-GCM";
                case "TLS_CHACHA20_POLY1305_SHA256":
                    return "CHACHA20-POLY1305";
                default:
                    throw new Error(`non-AEAD suite passed to cipherSuiteToAead: ${cipherSuite}`);
            }
        },
    };
}

// ===========================================================================
// TlsHandshakeContext — the consumer-side SPI
// ===========================================================================

describe("TlsHandshakeContext", () => {
    it("is satisfied by a quic-style consumer implementation", () => {
        const ctx = createMockContext();
        // Compile-time check: the literal above satisfies every field. Runtime
        // spot-checks of the SPI data surface the engine mutates.
        expect(ctx.cipherSuite).toBe("TLS_AES_128_GCM_SHA256");
        expect(ctx.currentPhase).toBe("init");
        expect(ctx.compression).toBeUndefined();
        expect(typeof ctx.sendAlert).toBe("function");
    });

    it("accepts a richer peerCertificate structurally (tls's ValidatedCertificate pattern)", () => {
        // tls's driver writes a ValidatedCertificate (Certificate plus chain
        // validation bookkeeping) into peerCertificate — a strict superset
        // must remain assignable to the contract's Certificate field.
        const leaf: Certificate = {
            tbsBytes: new Uint8Array(8),
            subjectPublicKeyInfo: new Uint8Array(8),
            subjectAltNames: ["example.com"],
            commonName: "example.com",
            notBefore: 1_600_000_000,
            notAfter: 1_900_000_000,
            keyUsageDigitalSignature: true,
            keyUsageKeyEncipherment: false,
            signatureScheme: "rsa_pss_rsae_sha256",
            signatureValue: new Uint8Array(16),
            issuer: "CN=Test Root",
            isCa: false,
        };
        const richer = { ...leaf, chainVerified: true, hostnameMatched: true };
        const ctx = createMockContext();
        ctx.peerCertificate = richer;
        expect(ctx.peerCertificate.commonName).toBe("example.com");
    });

    it("satisfies the public SDK surface type", () => {
        const ctx: PublicTlsHandshakeContext = createMockContext();
        expect(ctx.currentPhase).toBe("init");
    });
});

// ===========================================================================
// TlsHandshakeEngine — the injected engine (quic's call shape)
// ===========================================================================

describe("TlsHandshakeEngine", () => {
    it("runHandshake receives the quic call shape and mutates the context", async () => {
        const engine = createMockEngine();
        const ctx = createMockContext();
        const keyShares = (groups: readonly string[]): Promise<KeyPair[]> =>
            engine.generateKeyShares(groups, ctx.crypto);

        const secrets = await engine.runHandshake(
            ctx,
            config,
            "example.com",
            [new Uint8Array(0)],
            keyShares,
            1_700_000_000,
        );

        expect(engine.runHandshake).toHaveBeenCalledTimes(1);
        expect(ctx.currentPhase).toBe("application");
        expect(ctx.hsTrafficReady).toBe(true);
        expect(ctx.alpnProtocol).toBe("h3");
        expect(secrets.client.key).toHaveLength(16);
    });

    it("generateKeyShares is callable through quic's wrapper idiom", async () => {
        const engine = createMockEngine();
        const crypto = createMockCryptoProvider();
        const shares = await engine.generateKeyShares(["x25519", "X25519MLKEM768"], crypto);
        expect(shares).toHaveLength(2);
        expect(shares[0]?.algorithm).toBe("x25519");
        expect(engine.generateKeyShares).toHaveBeenCalledWith(
            ["x25519", "X25519MLKEM768"],
            crypto,
        );
    });

    it("cipherSuiteToAead maps all four negotiable TLS 1.3 suites", () => {
        const engine = createMockEngine();
        expect(engine.cipherSuiteToAead("TLS_AES_128_GCM_SHA256")).toBe("AES-128-GCM");
        expect(engine.cipherSuiteToAead("TLS_AES_128_CCM_SHA256")).toBe("AES-128-CCM");
        expect(engine.cipherSuiteToAead("TLS_AES_256_GCM_SHA384")).toBe("AES-256-GCM");
        expect(engine.cipherSuiteToAead("TLS_CHACHA20_POLY1305_SHA256")).toBe("CHACHA20-POLY1305");
    });

    it("satisfies the public SDK surface type", () => {
        const engine: PublicTlsHandshakeEngine = createMockEngine();
        expect(typeof engine.runHandshake).toBe("function");
    });
});

// ===========================================================================
// Wire-level data shapes
// ===========================================================================

describe("TLS wire-level data shapes", () => {
    it("ServerHello carries the negotiated suite and authoritative version", () => {
        const serverHello: ServerHello = {
            protocolVersion: 0x0303,
            random: new Uint8Array(32),
            sessionId: new Uint8Array(32),
            cipherSuite: "TLS_AES_256_GCM_SHA384",
            compressionMethod: 0,
            selectedVersion: { name: "TLS 1.3", wire: 0x0304 },
            extensions: new Uint8Array(0),
        };
        expect(serverHello.selectedVersion.name).toBe("TLS 1.3");
        const version: ProtocolVersion = serverHello.selectedVersion;
        expect(version.wire).toBe(0x0304);
    });

    it("TrafficSecrets / ApplicationTrafficSecrets are pure key+iv data", () => {
        const oneWay: TrafficSecrets = { key: new Uint8Array(32), iv: new Uint8Array(12) };
        const both: ApplicationTrafficSecrets = { client: oneWay, server: oneWay };
        expect(both.client.key).toHaveLength(32);
    });

    it("HandshakePhase and AlertLevel cover the engine's error surface", () => {
        const phases: readonly HandshakePhase[] = [
            "init", "client_hello", "server_hello", "key_exchange",
            "encrypted_extensions", "certificate", "certificate_verify",
            "finished", "client_finished", "application",
        ];
        expect(phases).toHaveLength(10);
        const levels: readonly AlertLevel[] = ["warning", "fatal"];
        expect(levels).toHaveLength(2);
    });
});
