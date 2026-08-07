/**
 * Tests for the IANA wire code tables exported from @browsercore/contracts.
 *
 * These are the only runtime values in the package — everything else is
 * TypeScript types erased at compile time. The tests verify the canonical
 * wire codes match the IANA TLS parameter registries.
 */

import { describe, it, expect } from "vitest";
import {
    CIPHER_GREASE_PLACEHOLDER,
    CIPHER_SUITE_CODES,
    NAMED_GROUP_CODES,
    SIGNATURE_SCHEME_CODES,
    VERSION_CODES,
} from "../src/models.js";

describe("CIPHER_SUITE_CODES", () => {
    it("maps TLS 1.3 cipher suites to their IANA codes", () => {
        expect(CIPHER_SUITE_CODES["TLS_AES_128_GCM_SHA256"]).toBe(0x1301);
        expect(CIPHER_SUITE_CODES["TLS_AES_256_GCM_SHA384"]).toBe(0x1302);
        expect(CIPHER_SUITE_CODES["TLS_CHACHA20_POLY1305_SHA256"]).toBe(0x1303);
    });

    it("maps TLS 1.2 ECDHE cipher suites to their IANA codes", () => {
        expect(CIPHER_SUITE_CODES["TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256"]).toBe(0xc02b);
        expect(CIPHER_SUITE_CODES["TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"]).toBe(0xc02f);
        expect(CIPHER_SUITE_CODES["TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256"]).toBe(0xcca9);
        expect(CIPHER_SUITE_CODES["TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256"]).toBe(0xcca8);
    });

    it("maps legacy RSA cipher suites", () => {
        expect(CIPHER_SUITE_CODES["TLS_RSA_WITH_AES_128_GCM_SHA256"]).toBe(0x009c);
        expect(CIPHER_SUITE_CODES["TLS_RSA_WITH_AES_256_GCM_SHA384"]).toBe(0x009d);
        expect(CIPHER_SUITE_CODES["TLS_RSA_WITH_3DES_EDE_CBC_SHA"]).toBe(0x000a);
    });

    it("uses the canonical GREASE placeholder value", () => {
        expect(CIPHER_GREASE_PLACEHOLDER).toBe("TLS_GREASE_RESERVED_0");
        expect(CIPHER_SUITE_CODES[CIPHER_GREASE_PLACEHOLDER]).toBe(0x0a0a);
    });
});

describe("NAMED_GROUP_CODES", () => {
    it("maps key exchange groups to their IANA codes", () => {
        expect(NAMED_GROUP_CODES["x25519"]).toBe(0x001d);
        expect(NAMED_GROUP_CODES["secp256r1"]).toBe(0x0017);
        expect(NAMED_GROUP_CODES["secp384r1"]).toBe(0x0018);
    });

    it("includes post-quantum hybrid groups", () => {
        expect(NAMED_GROUP_CODES["X25519Kyber768"]).toBe(0x6399);
        expect(NAMED_GROUP_CODES["X25519MLKEM768"]).toBe(0x11ec);
    });
});

describe("SIGNATURE_SCHEME_CODES", () => {
    it("maps ECDSA signature schemes to their IANA codes", () => {
        expect(SIGNATURE_SCHEME_CODES["ecdsa_secp256r1_sha256"]).toBe(0x0403);
        expect(SIGNATURE_SCHEME_CODES["ecdsa_secp384r1_sha384"]).toBe(0x0503);
    });

    it("maps RSA-PSS signature schemes to their IANA codes", () => {
        expect(SIGNATURE_SCHEME_CODES["rsa_pss_rsae_sha256"]).toBe(0x0804);
        expect(SIGNATURE_SCHEME_CODES["rsa_pss_rsae_sha384"]).toBe(0x0805);
    });

    it("maps Ed25519 to its IANA code", () => {
        expect(SIGNATURE_SCHEME_CODES["ed25519"]).toBe(0x0807);
    });
});

describe("VERSION_CODES", () => {
    it("maps TLS protocol versions to their wire codes", () => {
        expect(VERSION_CODES["TLS 1.3"]).toBe(0x0304);
        expect(VERSION_CODES["TLS 1.2"]).toBe(0x0303);
    });

    it("includes legacy versions for fallback", () => {
        expect(VERSION_CODES["TLS 1.1"]).toBe(0x0302);
        expect(VERSION_CODES["TLS 1.0"]).toBe(0x0301);
    });
});
