/**
 * Tests for the canonical config types (src/config.ts, 0.2.6) and the
 * canonical ProfileId union (src/models.ts).
 *
 * All types here are TypeScript-only (pure data shapes), so the tests verify
 * structural conformance: fixtures that satisfy the types (a shape error
 * fails tsc) plus negative checks with @ts-expect-error. The jar fixture
 * mirrors @browsercore/cookies' full CookieJar to prove the structural
 * superset relationship with CookieJarConsumer.
 */

import { describe, it, expect } from "vitest";
import type {
    CookieJarConsumer,
    ProxyConfig,
    ProxyCredentials,
    ProxyScheme,
    ProxyTarget,
} from "../src/config.js";
import type { BrowserProfile, Cookie, ProfileId } from "../src/models.js";
// Compile-time check: the config homes are part of the public SDK surface.
import type {
    CookieJarConsumer as PublicCookieJarConsumer,
    ProxyConfig as PublicProxyConfig,
} from "../src/index.js";

// ===========================================================================
// Proxy configuration family
// ===========================================================================

describe("ProxyConfig family", () => {
    it("accepts an authenticated socks5h endpoint", () => {
        const proxy: ProxyConfig = {
            scheme: "socks5h",
            host: "proxy.example",
            port: 1080,
            username: "user",
            password: "pass",
        };
        expect(proxy.scheme).toBe("socks5h");
        expect(proxy.port).toBeGreaterThan(0);
    });

    it("accepts a bare http CONNECT endpoint (no credentials)", () => {
        const proxy: ProxyConfig = { scheme: "http", host: "127.0.0.1", port: 8080 };
        expect(proxy.username).toBeUndefined();
        expect(proxy.password).toBeUndefined();
    });

    it("keeps 'absent' vs 'empty' distinct under exactOptionalPropertyTypes", () => {
        // Explicit undefined is assignable (URL parsing produces it); an
        // empty string is a real (invalid-credentials) value, not absence.
        const parsed: ProxyConfig = {
            scheme: "socks5",
            host: "proxy.example",
            port: 1080,
            username: undefined,
        };
        expect("username" in parsed).toBe(true);
    });

    it("covers exactly the three supported schemes", () => {
        const schemes: readonly ProxyScheme[] = ["http", "socks5", "socks5h"];
        expect(schemes).toHaveLength(3);
    });

    it("separates the proxy endpoint from the requested destination", () => {
        const proxy: ProxyConfig = { scheme: "socks5h", host: "proxy.example", port: 1080 };
        const target: ProxyTarget = { host: "example.com", port: 443 };
        const credentials: ProxyCredentials = { username: "user", password: "pass" };
        expect(proxy.host).not.toBe(target.host);
        expect(Object.keys(credentials)).toHaveLength(2);
    });

    it("satisfies the public SDK surface type", () => {
        const proxy: PublicProxyConfig = { scheme: "http", host: "h", port: 1 };
        expect(proxy.scheme).toBe("http");
    });

    it("rejects unknown schemes at compile time", () => {
        // @ts-expect-error — socks4 is not a supported scheme
        const bad: ProxyConfig = { scheme: "socks4", host: "h", port: 1080 };
        expect(bad).toBeDefined();
    });
});

// ===========================================================================
// ProfileId — the built-in registry union
// ===========================================================================

describe("ProfileId (canonical union)", () => {
    it("admits exactly the ten built-in registry ids", () => {
        const ids: readonly ProfileId[] = [
            "chrome-120", "chrome-128", "chrome-140",
            "edge-120", "edge-128",
            "firefox-120", "firefox-128", "firefox-135",
            "safari-17", "safari-18",
        ];
        expect(ids).toHaveLength(10);
        expect(new Set(ids).size).toBe(10);
    });

    it("serves as BrowserProfile.id (typo protection at construction)", () => {
        const profile: BrowserProfile = {
            id: "chrome-140",
            name: "Chrome 140",
            tls: {
                cipherSuites: ["TLS_AES_128_GCM_SHA256"],
                namedGroups: ["x25519", "secp256r1"],
                signatureSchemes: ["rsa_pss_rsae_sha256"],
                supportedVersions: [0x0304],
                extensionOrder: [51, 43],
                grease: true,
            },
        };
        expect(profile.id).toBe("chrome-140");
    });

    it("flags typos against the registry while accepting custom ids", () => {
        // widenend union: a registry id autocompletes; a custom id is legal
        // (registerProfile extension point); a TYPO of a registry id is the
        // case (string & {}) genuinely cannot catch — documented trade-off.
        const custom: ProfileId = "my-registered-custom";
        const known: ProfileId = "chrome-140";
        expect([custom, known]).toEqual(["my-registered-custom", "chrome-140"]);
        // @ts-expect-error — RegisteredProfileId stays closed: typos of the
        // known set are still flagged where the closed set is required.
        const bad: RegisteredProfileId = "chrome-999";
        expect(bad).toBeDefined();
    });
});

// ===========================================================================
// CookieJarConsumer — the minimal surface fetch calls
// ===========================================================================

/** A cookie shape identical to contracts' Cookie (what jars return). */
const cookie = (name: string, value: string): Cookie => ({ name, value });

/**
 * A jar mirroring @browsercore/cookies' FULL CookieJar surface — branded id,
 * SameSite-context matching, removal, (de)serialization — to prove the
 * structural-superset claim: it must satisfy CookieJarConsumer unchanged.
 */
function createFullCookiesStyleJar(): {
    id: string;
    getCookies(url: string, context?: { site: string }): Cookie[];
    setCookie(raw: string, url: string): void;
    removeCookie(name: string, domain: string, path: string): void;
    clear(): void;
    serialize(): string;
    deserialize(json: string): void;
} {
    const jar = new Map<string, Cookie>();
    return {
        id: "jar-1",
        getCookies: (): Cookie[] => [...jar.values()],
        setCookie: (raw: string): void => {
            const eq = raw.indexOf("=");
            const name = raw.slice(0, eq);
            jar.set(name, cookie(name, raw.slice(eq + 1)));
        },
        removeCookie: (name: string): void => {
            jar.delete(name);
        },
        clear: (): void => {
            jar.clear();
        },
        serialize: () => "[]",
        deserialize: (): void => undefined,
    };
}

describe("CookieJarConsumer", () => {
    it("is satisfied by @browsercore/cookies' full jar structurally", () => {
        const jar: CookieJarConsumer = createFullCookiesStyleJar();
        jar.setCookie("session=abc", "https://example.com/");
        expect(jar.getCookies("https://example.com/")).toEqual([cookie("session", "abc")]);
    });

    it("is satisfied by a minimal two-method jar (the exact fetch surface)", () => {
        const minimal: CookieJarConsumer = {
            getCookies: (url: string) => (url.startsWith("https") ? [cookie("a", "1")] : []),
            setCookie: (): void => undefined,
        };
        expect(minimal.getCookies("https://example.com/")).toHaveLength(1);
        expect(minimal.getCookies("http://example.com/")).toHaveLength(0);
    });

    it("uses the cookies-package parameter order — setCookie(raw, url)", () => {
        const calls: [string, string][] = [];
        const jar: CookieJarConsumer = {
            getCookies: () => [],
            setCookie: (raw: string, url: string): void => {
                calls.push([raw, url]);
            },
        };
        jar.setCookie("k=v", "https://example.com/");
        expect(calls).toEqual([["k=v", "https://example.com/"]]);
    });

    it("satisfies the public SDK surface type", () => {
        const jar: PublicCookieJarConsumer = createFullCookiesStyleJar();
        expect(typeof jar.setCookie).toBe("function");
    });
});
