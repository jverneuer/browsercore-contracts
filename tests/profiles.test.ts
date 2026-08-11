/**
 * Tests for the browser fingerprint profile models exported from
 * @browsercore/contracts.
 *
 * `TlsProfile`, `Http1Profile`, `Http2Profile`, `HpackProfile`, and
 * `Http2PriorityFrame` are TypeScript interfaces — erased at compile time.
 * These tests verify structural conformance two ways:
 *
 *   1. Compile-time: constructing a Chrome-representative object that
 *      satisfies each interface (a shape error would fail `tsc`).
 *   2. Runtime: asserting the impersonation fields are accessible and carry
 *      the documented Chrome reference values.
 *
 * Negative checks use `@ts-expect-error` — validated by `tsc`, not vitest.
 */

import { describe, it, expect } from "vitest";
import type {
    BrowserProfile,
    TlsProfile,
    Http1Profile,
    Http2Profile,
    HpackProfile,
    Http2PriorityFrame,
} from "../src/models.js";
// Compile-time check: the new interfaces are part of the public SDK surface.
import type {
    HpackProfile as PublicHpackProfile,
    Http2PriorityFrame as PublicHttp2PriorityFrame,
} from "../src/index.js";

// ===========================================================================
// Chrome-representative fixtures
// ===========================================================================

/**
 * A full TlsProfile exercising every impersonation field. Values follow the
 * documented Chrome reference fingerprints.
 */
const chromeTls: TlsProfile = {
    cipherSuites: ["TLS_GREASE_RESERVED_0", "TLS_AES_128_GCM_SHA256"],
    namedGroups: ["x25519", "secp256r1"],
    signatureSchemes: ["ecdsa_secp256r1_sha256", "rsa_pss_rsae_sha256"],
    supportedVersions: [0x0304, 0x0303],
    extensionOrder: [0, 11, 43, 51],
    grease: true,
    ecPointFormats: [1, 0],
    compressCertificateAlgorithms: [2],
    recordPadding: 16,
    keyShareGroups: ["x25519", "secp256r1"],
};

/**
 * A full Http1Profile exercising every impersonation field.
 */
const chromeHttp1: Http1Profile = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0",
    headerOrder: ["host", "connection", "content-length"],
    connectionSettings: new Map([["connection", "keep-alive"]]),
    headerCasing: "title",
    defaultHeadersCased: { etag: "ETag", "www-authenticate": "WWW-Authenticate" },
};

/**
 * A full HpackProfile matching Chrome's HPACK encoder behaviour.
 */
const chromeHpack: HpackProfile = {
    maxTableSize: 4096,
    useHuffman: true,
    useIndexing: true,
    neverIndex: ["authorization", "cookie"],
};

/**
 * A sample HTTP/2 priority frame used to exercise `Http2PriorityFrame`.
 */
const samplePriorityFrame: Http2PriorityFrame = {
    streamId: 3,
    streamDependency: 0,
    exclusive: true,
    weight: 256,
};

/**
 * A full Http2Profile exercising every impersonation field.
 */
const chromeHttp2: Http2Profile = {
    settings: new Map([
        ["HEADER_TABLE_SIZE", 4096],
        ["INITIAL_WINDOW_SIZE", 6291456],
    ]),
    headerOrder: [":method", ":authority", ":scheme", ":path"],
    initialWindowSize: 6291456,
    maxFrameSize: 16384,
    settingsOrder: [1, 2, 4, 3],
    grease: true,
    connectionWindowUpdate: 12517377,
    pseudoHeaderOrder: [":method", ":authority", ":scheme", ":path"],
    hpack: chromeHpack,
    priorityFrames: [samplePriorityFrame],
};

// ===========================================================================
// TlsProfile
// ===========================================================================

describe("TlsProfile", () => {
    it("accepts all impersonation fields", () => {
        // Compile-time: the assignment fails if any field has the wrong type.
        const typed: TlsProfile = chromeTls;
        expect(typed).toBe(chromeTls);
    });

    it("exposes the Chrome reference values", () => {
        expect(chromeTls.ecPointFormats).toEqual([1, 0]);
        expect(chromeTls.compressCertificateAlgorithms).toEqual([2]);
        expect(chromeTls.recordPadding).toBe(16);
        expect(chromeTls.keyShareGroups).toEqual(["x25519", "secp256r1"]);
    });

    it("remains valid without any optional impersonation fields (backward compatible)", () => {
        const minimal: TlsProfile = {
            cipherSuites: [],
            namedGroups: [],
            signatureSchemes: [],
            supportedVersions: [],
            extensionOrder: [],
            grease: false,
        };
        expect(minimal.grease).toBe(false);
        expect(minimal.ecPointFormats).toBeUndefined();
    });
});

// ===========================================================================
// Http1Profile
// ===========================================================================

describe("Http1Profile", () => {
    it("accepts the casing impersonation fields", () => {
        const typed: Http1Profile = chromeHttp1;
        expect(typed).toBe(chromeHttp1);
    });

    it("exposes the Chrome reference casing values", () => {
        expect(chromeHttp1.headerCasing).toBe("title");
        expect(chromeHttp1.defaultHeadersCased).toEqual({
            etag: "ETag",
            "www-authenticate": "WWW-Authenticate",
        });
    });

    it("remains valid without any optional impersonation fields (backward compatible)", () => {
        const minimal: Http1Profile = {
            userAgent: "test-agent",
            headerOrder: [],
            connectionSettings: new Map(),
        };
        expect(minimal.headerCasing).toBeUndefined();
        expect(minimal.defaultHeadersCased).toBeUndefined();
    });
});

// ===========================================================================
// Http2Profile
// ===========================================================================

describe("Http2Profile", () => {
    it("accepts all impersonation fields including hpack and priority frames", () => {
        const typed: Http2Profile = chromeHttp2;
        expect(typed).toBe(chromeHttp2);
    });

    it("exposes the Chrome reference HTTP/2 values", () => {
        expect(chromeHttp2.settingsOrder).toEqual([1, 2, 4, 3]);
        expect(chromeHttp2.grease).toBe(true);
        expect(chromeHttp2.connectionWindowUpdate).toBe(12517377);
        expect(chromeHttp2.pseudoHeaderOrder).toEqual([
            ":method",
            ":authority",
            ":scheme",
            ":path",
        ]);
    });

    it("threads the HpackProfile and priority frames", () => {
        expect(chromeHttp2.hpack).toBe(chromeHpack);
        expect(chromeHttp2.priorityFrames).toEqual([samplePriorityFrame]);
    });

    it("remains valid without any optional impersonation fields (backward compatible)", () => {
        const minimal: Http2Profile = {
            settings: new Map(),
            headerOrder: [],
            initialWindowSize: 65535,
            maxFrameSize: 16384,
        };
        expect(minimal.hpack).toBeUndefined();
        expect(minimal.priorityFrames).toBeUndefined();
    });
});

// ===========================================================================
// HpackProfile
// ===========================================================================

describe("HpackProfile", () => {
    it("accepts all four required fields", () => {
        const typed: HpackProfile = chromeHpack;
        expect(typed).toBe(chromeHpack);
    });

    it("exposes the Chrome reference HPACK values", () => {
        expect(chromeHpack.maxTableSize).toBe(4096);
        expect(chromeHpack.useHuffman).toBe(true);
        expect(chromeHpack.useIndexing).toBe(true);
        expect(chromeHpack.neverIndex).toEqual(["authorization", "cookie"]);
    });

    it("rejects a missing required field (validated by tsc)", () => {
        // @ts-expect-error — maxTableSize is required.
        const _invalid: HpackProfile = {
            useHuffman: true,
            useIndexing: true,
            neverIndex: [],
        };
        expect(_invalid).toBeDefined();
    });
});

// ===========================================================================
// Http2PriorityFrame
// ===========================================================================

describe("Http2PriorityFrame", () => {
    it("accepts all four required fields", () => {
        const typed: Http2PriorityFrame = samplePriorityFrame;
        expect(typed).toBe(samplePriorityFrame);
    });

    it("exposes the dependency and weight values", () => {
        expect(samplePriorityFrame.streamId).toBe(3);
        expect(samplePriorityFrame.streamDependency).toBe(0);
        expect(samplePriorityFrame.exclusive).toBe(true);
        expect(samplePriorityFrame.weight).toBe(256);
    });

    it("rejects a missing required field (validated by tsc)", () => {
        // @ts-expect-error — weight is required.
        const _invalid: Http2PriorityFrame = {
            streamId: 1,
            streamDependency: 0,
            exclusive: false,
        };
        expect(_invalid).toBeDefined();
    });
});

// ===========================================================================
// Public surface
// ===========================================================================

describe("public surface", () => {
    it("re-exports HpackProfile and Http2PriorityFrame from the package index", () => {
        // These aliases come from ../src/index.js. If the re-export is removed,
        // the import at the top of this file fails to compile. The assertions
        // below additionally confirm they are the same structural types.
        const hpack: PublicHpackProfile = chromeHpack;
        const frame: PublicHttp2PriorityFrame = samplePriorityFrame;
        expect(hpack).toBe(chromeHpack);
        expect(frame).toBe(samplePriorityFrame);
    });

    it("composes a full BrowserProfile from the extended profiles", () => {
        const profile: BrowserProfile = {
            id: "chrome-124",
            name: "Chrome 124",
            tls: chromeTls,
            http1: chromeHttp1,
            http2: chromeHttp2,
        };
        expect(profile.tls.keyShareGroups).toEqual(["x25519", "secp256r1"]);
        expect(profile.http2?.hpack?.maxTableSize).toBe(4096);
        expect(profile.http1?.headerCasing).toBe("title");
    });
});
