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
import type { CryptoProvider } from "../src/contracts.js";
import type { EventProvider } from "../src/events.js";
import type { Telemetry } from "../src/telemetry.js";
import type { Time } from "../src/time.js";
import type { Network } from "../src/net.js";
import type {
    HashId,
    X25519KeyPair,
    EcdhKeyPair,
    EcdhCurve,
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
        gzipSync: echo,
        gunzipSync: echo,
        deflateSync: echo,
        inflateSync: echo,
        brotliCompressSync: echo,
        brotliDecompressSync: echo,
        decompressSync: echo,
    };
}

/**
 * Build a mock CryptoProvider — stubs every primitive with a zero-filled
 * Uint8Array of the requested length (or a minimal valid shape).
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

/** Build a Time bundle with a controllable clock and scheduler. */
function createMockTime(): Time {
    const clock: Time["clock"] = {
        now: (): number => 0,
        monotonic: (): bigint => 0n,
    };
    const duration: Time["scheduler"] extends { delay: (d: infer D) => void }
        ? D
        : never = { milliseconds: 0, seconds: () => 0 };
    const controller = new AbortController();
    const scheduler: Time["scheduler"] = {
        delay: vi.fn().mockResolvedValue(undefined),
        timeout: vi.fn().mockReturnValue(controller.signal),
        deadline: vi.fn().mockReturnValue({
            signal: controller.signal,
            expiresAt: 0n,
        }),
    };
    return { clock, scheduler };
}

/** Build a Network bundle with stubbed TCP, DNS, and UDP. */
function createMockNetwork(): Network {
    const udp: Network["udp"] = {
        id: "mock-udp",
        send: vi.fn().mockResolvedValue(undefined),
        recv: vi.fn().mockResolvedValue({
            data: new Uint8Array(),
            from: { address: "127.0.0.1", port: 0 },
        }),
        close: vi.fn().mockResolvedValue(undefined),
    };
    const dns: Network["dns"] = {
        lookup: vi.fn().mockResolvedValue([
            { address: "127.0.0.1", family: 4 as const },
        ]),
    };
    const tcp: Network["tcp"] = {
        connect: vi.fn().mockReturnValue({
            write: vi.fn().mockReturnValue(true),
            end: vi.fn(),
            destroy: vi.fn(),
            destroyed: false,
            once: vi.fn(),
            on: vi.fn(),
        }),
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

    it("gzipSync returns Uint8Array", () => {
        const result = compression.gzipSync(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("gunzipSync returns Uint8Array", () => {
        const result = compression.gunzipSync(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("deflateSync returns Uint8Array", () => {
        const result = compression.deflateSync(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("inflateSync returns Uint8Array", () => {
        const result = compression.inflateSync(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("brotliCompressSync returns Uint8Array", () => {
        const result = compression.brotliCompressSync(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("brotliDecompressSync returns Uint8Array", () => {
        const result = compression.brotliDecompressSync(sample);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it("decompressSync returns Uint8Array", () => {
        const result = compression.decompressSync(sample);
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
});

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
        // Network sub-interfaces
        expect(platform.network.tcp).toBeDefined();
        expect(platform.network.dns).toBeDefined();
        expect(platform.network.udp).toBeDefined();

        // Crypto provider
        expect(typeof cryptoProvider(platform)).toBe("object");

        // Compression methods
        expect(typeof platform.compression.gzipSync).toBe("function");

        // EventProvider methods
        expect(typeof platform.events.on).toBe("function");
        expect(typeof platform.events.emit).toBe("function");

        // Telemetry sub-interfaces
        expect(typeof platform.telemetry.logger.info).toBe("function");
        expect(typeof platform.telemetry.tracer.startSpan).toBe("function");
        expect(typeof platform.telemetry.metrics.add).toBe("function");

        // Time sub-interfaces
        expect(typeof platform.time.clock.now).toBe("function");
        expect(typeof platform.time.scheduler.delay).toBe("function");
    });
});

/** Local helper — mirrors the public Crypto surface for assertions. */
function cryptoProvider(platform: Platform): CryptoProvider {
    return platform.crypto.provider;
}
