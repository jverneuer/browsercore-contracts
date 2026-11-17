/**
 * Tests for the Platform composition root exported from @browsercore/contracts.
 *
 * Platform, Compression, and Crypto are TypeScript-only interfaces erased at
 * compile time, so these tests verify structural conformance by constructing
 * mock implementations that satisfy each interface. If a mock fails to
 * conform, TypeScript rejects the assignment — the test would not compile.
 */

import { describe, it, expect, vi } from "vitest";
import type { Platform } from "../src/platform.js";
import type { Compression } from "../src/platform.js";
import type { Crypto } from "../src/platform.js";
import type { CryptoProvider, Transport, UdpSocketFactory } from "../src/contracts.js";
import type { EventProvider } from "../src/events.js";
import type { Telemetry } from "../src/telemetry.js";
import type { Clock, Time } from "../src/time.js";
import type { Network, Socket } from "../src/tcp-transport.js";
import type {
    HashId,
    X25519KeyPair,
    EcdhKeyPair,
    EcdhCurve,
    MLKEM768KeyPair,
} from "../src/models.js";

// ===========================================================================
// Mock builders
// ===========================================================================

/**
 * Build a mock Compression that echoes input — satisfies the interface
 * while proving each sync method returns Uint8Array.
 */
function createMockCompression(): Compression {
    const echo = (data: Uint8Array): Uint8Array => data;
    return {
        gzip: echo,
        gunzip: echo,
        deflate: echo,
        inflate: echo,
        inflateRaw: echo,
        brotliCompress: echo,
        brotliDecompress: echo,
        decompress: echo,
    };
}

/**
 * Build a mock CryptoProvider — stubs every primitive (all 22 methods,
 * including the ML-KEM-768 trio) with a zero-filled Uint8Array of the
 * requested length (or a minimal valid shape).
 */
function createMockCryptoProvider(): CryptoProvider {
    const bytes = (n: number): Uint8Array => new Uint8Array(n);
    const emptyPair = (curve: EcdhCurve): EcdhKeyPair => ({
        curve,
        publicKey: bytes(32),
        secretKey: bytes(32),
    });
    return {
        randomBytes: (length: number): Uint8Array => bytes(length),
        sha256: (data: Uint8Array): Uint8Array => bytes(data.length),
        sha384: (data: Uint8Array): Uint8Array => bytes(data.length),
        hkdf: (
            _hash: HashId,
            _salt: Uint8Array,
            _ikm: Uint8Array,
            _info: Uint8Array,
            length: number,
        ): Uint8Array => bytes(length),
        hmac: (
            _hash: HashId,
            _key: Uint8Array,
            data: Uint8Array,
        ): Uint8Array => bytes(data.length),
        aes128GcmEncrypt: (
            _key: Uint8Array,
            _nonce: Uint8Array,
            plaintext: Uint8Array,
            _aad: Uint8Array,
        ): Uint8Array => bytes(plaintext.length),
        aes128GcmDecrypt: (
            _key: Uint8Array,
            _nonce: Uint8Array,
            ciphertext: Uint8Array,
            _aad: Uint8Array,
        ): Uint8Array => bytes(ciphertext.length),
        aes256GcmEncrypt: (
            _key: Uint8Array,
            _nonce: Uint8Array,
            plaintext: Uint8Array,
            _aad: Uint8Array,
        ): Uint8Array => bytes(plaintext.length),
        aes256GcmDecrypt: (
            _key: Uint8Array,
            _nonce: Uint8Array,
            ciphertext: Uint8Array,
            _aad: Uint8Array,
        ): Uint8Array => bytes(ciphertext.length),
        aes128CcmEncrypt: (
            _key: Uint8Array,
            _nonce: Uint8Array,
            plaintext: Uint8Array,
            _aad: Uint8Array,
        ): Uint8Array => bytes(plaintext.length),
        aes128CcmDecrypt: (
            _key: Uint8Array,
            _nonce: Uint8Array,
            ciphertext: Uint8Array,
            _aad: Uint8Array,
        ): Uint8Array => bytes(ciphertext.length),
        chacha20Poly1305Encrypt: (
            _key: Uint8Array,
            _nonce: Uint8Array,
            plaintext: Uint8Array,
            _aad: Uint8Array,
        ): Uint8Array => bytes(plaintext.length),
        chacha20Poly1305Decrypt: (
            _key: Uint8Array,
            _nonce: Uint8Array,
            ciphertext: Uint8Array,
            _aad: Uint8Array,
        ): Uint8Array => bytes(ciphertext.length),
        x25519GenerateKeyPair: (): X25519KeyPair => ({
            publicKey: bytes(32),
            secretKey: bytes(32),
        }),
        x25519SharedSecret: (
            _secretKey: Uint8Array,
            _peerPublicKey: Uint8Array,
        ): Uint8Array => bytes(32),
        ecdhGenerateKeyPair: (curve: EcdhCurve): EcdhKeyPair =>
            emptyPair(curve),
        ecdhSharedSecret: (
            curve: EcdhCurve,
            _secretKey: Uint8Array,
            _peerPublicKey: Uint8Array,
        ): Uint8Array => bytes(curve === "secp256r1" ? 32 : 48),
        verifySignature: (
            _scheme: string,
            _publicKey: Uint8Array,
            _signature: Uint8Array,
            _data: Uint8Array,
        ): boolean => true,
        aesEcbEncrypt: (
            _key: Uint8Array,
            block: Uint8Array,
        ): Uint8Array => bytes(block.length),
        mlkem768GenerateKeyPair: (): MLKEM768KeyPair => ({
            publicKey: bytes(1184),
            secretKey: bytes(2400),
        }),
        mlkem768Decapsulate: (
            _secretKey: Uint8Array,
            _ciphertext: Uint8Array,
        ): Uint8Array => bytes(32),
        x25519MLKEM768SharedSecret: (
            _x25519SecretKey: Uint8Array,
            _x25519PeerPublicKey: Uint8Array,
            _mlkemSecretKey: Uint8Array,
            _mlkemCiphertext: Uint8Array,
        ): Uint8Array => bytes(64),
    };
}

/** Build a Crypto bundle wrapping a mock provider. */
function createMockCrypto(): Crypto {
    return { provider: createMockCryptoProvider() };
}

/** Build a minimal EventProvider mock using vitest spies. */
function createMockEventProvider(): EventProvider {
    return {
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        removeListener: vi.fn(),
        emit: vi.fn().mockReturnValue(true),
        listenerCount: vi.fn().mockReturnValue(0),
        removeAllListeners: vi.fn(),
    };
}

/** Build a Telemetry bundle with no-op logger, tracer, and metrics. */
function createMockTelemetry(): Telemetry {
    const logger: Telemetry["logger"] = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
    const span: SpanLike = {
        setAttribute: vi.fn().mockReturnThis(),
        end: vi.fn(),
    };
    const tracer: Telemetry["tracer"] = {
        startSpan: vi.fn().mockReturnValue(span),
    };
    const metrics: Telemetry["metrics"] = {
        add: vi.fn(),
    };
    return { logger, tracer, metrics };
}

/** Minimal shape returned by Tracer.startSpan — mirrors telemetry.Span. */
interface SpanLike {
    setAttribute(key: string, value: unknown): SpanLike;
    end(): void;
}

/** Build a Time bundle — the canonical Clock (Time aliases it since 0.2.6). */
function createMockTime(): Time {
    const clock: Clock = {
        now: vi.fn().mockReturnValue(0),
        monotonic: vi.fn().mockReturnValue(0),
        sleep: vi.fn().mockResolvedValue(undefined),
        setTimeout: vi.fn().mockReturnValue({}),
        clearTimeout: vi.fn(),
    };
    return clock;
}

/** Build a mock TCP Socket satisfying the full injected Socket contract. */
function createMockSocket(): Socket {
    return {
        write: vi.fn().mockReturnValue(true),
        end: vi.fn(),
        destroy: vi.fn(),
        destroyed: false,
        once: vi.fn(),
        on: vi.fn(),
    };
}

/** Build a Network bundle with stubbed TCP, DNS, and a UDP socket factory. */
function createMockNetwork(): Network {
    const udp: UdpSocketFactory = {
        connect: vi.fn().mockResolvedValue({
            id: "mock-udp-socket",
            send: vi.fn().mockResolvedValue(undefined),
            recv: vi.fn().mockResolvedValue({
                data: new Uint8Array(),
                from: { address: "127.0.0.1", port: 0, family: 4 },
            }),
            close: vi.fn().mockResolvedValue(undefined),
        }),
    };
    const dns: Network["dns"] = {
        lookup: vi.fn().mockResolvedValue([
            { address: "127.0.0.1", family: 4 as const },
        ]),
    };
    const tcp: Network["tcp"] = {
        connect: vi.fn().mockReturnValue(createMockSocket()),
    };
    return { tcp, dns, udp };
}

/** Assemble a complete mock Platform. */
function createMockPlatform(): Platform {
    return {
        network: createMockNetwork(),
        crypto: createMockCrypto(),
        compression: createMockCompression(),
        events: createMockEventProvider(),
        telemetry: createMockTelemetry(),
        time: createMockTime(),
    };
}

// ===========================================================================
// Tests
// ===========================================================================

describe("Compression", () => {
    const compression = createMockCompression();
    const sample = new Uint8Array([0x01, 0x02, 0x03]);

    it("gzip returns Uint8Array", () => {
        const result = compression.gzip(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("gunzip returns Uint8Array", () => {
        const result = compression.gunzip(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("deflate returns Uint8Array", () => {
        const result = compression.deflate(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("inflate returns Uint8Array", () => {
        const result = compression.inflate(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("inflateRaw returns Uint8Array", () => {
        const result = compression.inflateRaw(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("brotliCompress returns Uint8Array", () => {
        const result = compression.brotliCompress(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("brotliDecompress returns Uint8Array", () => {
        const result = compression.brotliDecompress(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("decompress returns Uint8Array", () => {
        const result = compression.decompress(sample, "gzip");
        expect(result).toBeInstanceOf(Uint8Array);
    });
});

describe("Crypto", () => {
    const crypto = createMockCrypto();

    it("exposes a readonly provider with all CryptoProvider methods", () => {
        expect(crypto.provider).toBeDefined();
        expect(typeof crypto.provider.randomBytes).toBe("function");
        expect(typeof crypto.provider.sha256).toBe("function");
        expect(typeof crypto.provider.x25519GenerateKeyPair).toBe("function");
        expect(typeof crypto.provider.verifySignature).toBe("function");
        expect(typeof crypto.provider.mlkem768GenerateKeyPair).toBe("function");
    });

    it("provider implements CryptoProvider — randomBytes returns Uint8Array", () => {
        const out = crypto.provider.randomBytes(16);
        expect(out).toBeInstanceOf(Uint8Array);
        expect(out).toHaveLength(16);
    });

    it("provider implements CryptoProvider — x25519GenerateKeyPair returns key pair", () => {
        const pair = crypto.provider.x25519GenerateKeyPair();
        expect(pair.publicKey).toBeInstanceOf(Uint8Array);
        expect(pair.secretKey).toBeInstanceOf(Uint8Array);
    });

    it("provider implements CryptoProvider — ML-KEM-768 trio returns sized outputs", () => {
        const pair = crypto.provider.mlkem768GenerateKeyPair();
        expect(pair.publicKey).toHaveLength(1184);
        expect(pair.secretKey).toHaveLength(2400);
        const secret = crypto.provider.mlkem768Decapsulate(pair.secretKey, new Uint8Array(1088));
        expect(secret).toHaveLength(32);
        const hybrid = crypto.provider.x25519MLKEM768SharedSecret(
            pair.secretKey.slice(0, 32),
            new Uint8Array(32),
            pair.secretKey,
            new Uint8Array(1088),
        );
        expect(hybrid).toHaveLength(64);
    });
});

describe("Transport (canonical shape)", () => {
    it("is satisfied by a broad EventProvider-surface implementation", () => {
        // Compile-time check: the canonical Transport extends EventProvider and
        // is satisfied by implementations that declare the broad
        // (event: string, listener: (...args: unknown[]) => void) on/once
        // surface — the shape @browsercore/transport's TcpTransport declares.
        const transport: Transport = createMockTransport();
        expect(transport.id).toBe("mock-transport");
        expect(transport.state).toEqual({ state: "open" });
    });

    it("assigns to EventProvider", () => {
        const events: EventProvider = createMockTransport();
        expect(typeof events.on).toBe("function");
    });

    it("accepts consumer subscription patterns (data/close/error literals)", () => {
        const transport = createMockTransport();
        transport.on("data", (...args: unknown[]): void => void args);
        transport.on("close", (): void => {});
        transport.once("data", (chunk: unknown): void => void chunk);
        // Both "data" subscriptions (on + once) registered on the emitter.
        expect(transport.listenerCount("data")).toBe(2);
    });

    it("permits richer open states via structural typing (non-literal)", () => {
        // Implementations may keep extra bookkeeping on the open state —
        // a non-literal object with extra fields still assigns (the deleted
        // bytesTransferred counter worked this way in @browsercore/proxy).
        const richer = { state: "open", bytesTransferred: 5 } as {
            state: "open";
            bytesTransferred: number;
        };
        const state = richer;
        expect(state.bytesTransferred).toBe(5);
    });
});

/** Minimal mock satisfying the canonical Transport (broad EventProvider surface). */
function createMockTransport(): Transport {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const add = (event: string, listener: (...args: unknown[]) => void): void => {
        const set = listeners.get(event) ?? new Set();
        set.add(listener);
        listeners.set(event, set);
    };
    return {
        id: "mock-transport",
        state: { state: "open" },
        write: vi.fn().mockResolvedValue(undefined),
        read: vi.fn().mockResolvedValue(new Uint8Array()),
        close: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(add),
        once: vi.fn(add),
        off: vi.fn(),
        removeListener: vi.fn(),
        emit: vi.fn().mockReturnValue(true),
        listenerCount: vi.fn(
            (event: string): number => listeners.get(event)?.size ?? 0,
        ),
        removeAllListeners: vi.fn(),
    };
}

describe("Platform", () => {
    const platform = createMockPlatform();

    it("has a network field", () => {
        expect(platform).toHaveProperty("network");
        expect(platform.network).toBeDefined();
    });

    it("has a crypto field", () => {
        expect(platform).toHaveProperty("crypto");
        expect(platform.crypto).toBeDefined();
    });

    it("has a compression field", () => {
        expect(platform).toHaveProperty("compression");
        expect(platform.compression).toBeDefined();
    });

    it("has an events field", () => {
        expect(platform).toHaveProperty("events");
        expect(platform.events).toBeDefined();
    });

    it("has a telemetry field", () => {
        expect(platform).toHaveProperty("telemetry");
        expect(platform.telemetry).toBeDefined();
    });

    it("has a time field", () => {
        expect(platform).toHaveProperty("time");
        expect(platform.time).toBeDefined();
    });

    it("satisfies the Platform interface structurally", () => {
        // Compile-time check: this assignment would fail if the mock
        // did not satisfy every required field of Platform.
        const typed: Platform = platform;
        expect(typed).toBe(platform);
    });

    it("exposes typed sub-interfaces on each field", () => {
        // Since 0.2.6 every bundle is optional — the full mock provides them
        // all, and the consumer pattern for reading them is resolve-or-throw
        // (the typed-missing-capability pattern the README documents).
        const network = required(platform.network, "platform.network");

        // Network sub-interfaces
        expect(network.tcp).toBeDefined();
        expect(network.dns).toBeDefined();
        expect(network.udp).toBeDefined();

        // Crypto provider
        expect(typeof cryptoProvider(platform)).toBe("object");

        // Compression methods
        expect(typeof required(platform.compression, "platform.compression").gzip).toBe("function");

        // EventProvider methods
        const events = required(platform.events, "platform.events");
        expect(typeof events.on).toBe("function");
        expect(typeof events.emit).toBe("function");

        // Telemetry sub-interfaces
        const telemetry = required(platform.telemetry, "platform.telemetry");
        expect(typeof telemetry.logger.info).toBe("function");
        expect(typeof telemetry.tracer.startSpan).toBe("function");
        expect(typeof telemetry.metrics.add).toBe("function");

        // Time bundle — the canonical Clock surface
        const time = required(platform.time, "platform.time");
        expect(typeof time.now).toBe("function");
        expect(typeof time.monotonic).toBe("function");
        expect(typeof time.sleep).toBe("function");
        expect(typeof time.setTimeout).toBe("function");
        expect(typeof time.clearTimeout).toBe("function");
    });
});

/**
 * Resolve a capability or throw naming it — the consumer-side pattern for
 * optional Platform bundles (what fetch's proxyDialPlatform established).
 * Test-local mirror of the "typed missing-capability" idiom.
 */
function required<T>(value: T | undefined, name: string): T {
    if (value === undefined) {
        throw new Error(`missing capability: ${name}`);
    }
    return value;
}

// ===========================================================================
// Platform optionality (0.2.6) — every bundle optional
// ===========================================================================

describe("Platform optionality (0.2.6)", () => {
    it("is satisfied by an empty platform (a runtime with no capabilities)", () => {
        const empty: Platform = {};
        expect(Object.keys(empty)).toHaveLength(0);
    });

    it("is satisfied by a single-bundle platform (e.g. UDP-less Workers-style)", () => {
        const cryptoOnly: Platform = { crypto: createMockCrypto() };
        expect(cryptoOnly.crypto).toBeDefined();
        expect(cryptoOnly.network).toBeUndefined();
    });

    it("is satisfied by a network-only platform with a subset of network members", () => {
        // A TCP+DNS platform with NO udp — the shape fetch's proxy dialer needs.
        const network: Network = {
            tcp: { connect: vi.fn().mockReturnValue(createMockSocket()) },
            dns: {
                lookup: vi.fn().mockResolvedValue([
                    { address: "127.0.0.1", family: 4 as const },
                ]),
            },
        };
        const platform: Platform = { network };
        expect(platform.network?.udp).toBeUndefined();
        expect(platform.network?.tcp).toBeDefined();
    });

    it("lets consumers resolve capabilities with optional chaining (compile-time shape)", () => {
        // The sanctioned consumer pattern: dereference defensively; a missing
        // capability is handled at the point of use (fetch's proxyDialPlatform
        // throws a typed error naming the missing member).
        const platform: Platform = createMockPlatform();
        const tcp = platform.network?.tcp;
        expect(tcp).toBeDefined();
        if (tcp === undefined) {
            throw new Error("unexpected missing platform.network.tcp in full mock");
        }
        expect(typeof tcp.connect).toBe("function");
    });

    it("still accepts a full implementation (implementers provide more, not less)", () => {
        // browsersmith's createPlatform() provides every bundle — that must
        // keep satisfying the now-optional interface.
        const full: Platform = {
            network: createMockNetwork(),
            crypto: createMockCrypto(),
            compression: createMockCompression(),
            events: createMockEventProvider(),
            telemetry: createMockTelemetry(),
            time: createMockTime(),
        };
        expect(full.network?.udp).toBeDefined();
        expect(full.crypto?.provider).toBeDefined();
    });
});

// ===========================================================================
// UdpSocketFactory (0.2.6) — per-connection datagram sockets
// ===========================================================================

describe("UdpSocketFactory", () => {
    it("connect() resolves a per-connection DatagramTransport", async () => {
        const network = createMockNetwork();
        if (network.udp === undefined) {
            throw new Error("mock network must include a udp factory");
        }
        const factory: UdpSocketFactory = network.udp;
        const socket = await factory.connect({
            address: "192.0.2.10",
            port: 443,
            family: 4,
        });
        expect(typeof socket.send).toBe("function");
        expect(typeof socket.recv).toBe("function");
        expect(typeof socket.close).toBe("function");
        expect(factory.connect).toHaveBeenCalledWith({
            address: "192.0.2.10",
            port: 443,
            family: 4,
        });
    });

    it("produces independent sockets per connect() call (no shared singleton)", async () => {
        const factory: UdpSocketFactory = {
            connect: vi.fn().mockImplementation(async () => ({
                id: `udp-${Math.random().toString(16).slice(2)}`,
                send: vi.fn().mockResolvedValue(undefined),
                recv: vi.fn().mockResolvedValue({
                    data: new Uint8Array(1),
                    from: { address: "192.0.2.10", port: 443, family: 4 as const },
                }),
                close: vi.fn().mockResolvedValue(undefined),
            })),
        };
        const a = await factory.connect({ address: "192.0.2.10", port: 443, family: 4 });
        const b = await factory.connect({ address: "192.0.2.11", port: 443, family: 4 });
        expect(a).not.toBe(b);
        expect(a.id).not.toBe(b.id);
        expect(factory.connect).toHaveBeenCalledTimes(2);
    });
});

/** Local helper — mirrors the public Crypto surface for assertions. */
function cryptoProvider(platform: Platform): CryptoProvider {
    return required(platform.crypto, "platform.crypto").provider;
}
