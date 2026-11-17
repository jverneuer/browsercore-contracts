/**
 * Canonical config types — the shared configuration vocabulary.
 *
 * Homes for pure-data configuration shapes that cross package boundaries
 * (replaceability audit 2026-11-16, remediation item #3 groundwork:
 * "contracts-ify fetch's public option types" — fetch's public API is welded
 * to sibling concrete types; these canonical definitions let the next wave
 * alias the owning packages onto them instead).
 *
 * Canonical-with-alias-next-wave: each family below is copied verbatim from
 * the package that owns it today. That package re-exports the canonical type
 * in the next wave (the rename-free adoption pattern transport/crypto
 * performed for Transport/CryptoProvider in 0.2.5), so there is exactly one
 * definition and zero drift.
 *
 * Litmus test: pure data, no behavior — if it has methods with logic, it is
 * a contract, not a config, and does not belong here.
 */

import type { Cookie } from "./models.js";

// ===========================================================================
// Proxy configuration (canonical home; alias arrives with @browsercore/proxy)
// ===========================================================================

/**
 * Proxy schemes.
 *
 * - `http` — HTTP CONNECT tunneling (RFC 9110 §9.3.6)
 * - `socks5` — SOCKS5 with client-side DNS: the hostname is resolved locally
 *   and the resolved IP is sent on the wire
 * - `socks5h` — SOCKS5 with remote DNS: the hostname is sent verbatim and
 *   the proxy resolves it (curl's `socks5h` semantics)
 */
export type ProxyScheme = "http" | "socks5" | "socks5h";

/**
 * A parsed, validated proxy endpoint.
 *
 * Produced by `@browsercore/proxy`'s `parseProxyUrl` or hand-assembled by the
 * caller. All fields are readonly — configs are shared, never mutated.
 *
 * The `username`/`password` fields use an explicit `| undefined` so values
 * parsed from URLs (where "absent" and "empty" genuinely differ) stay
 * assignable under `exactOptionalPropertyTypes`.
 */
export interface ProxyConfig {
    /** Tunneling scheme. */
    readonly scheme: ProxyScheme;
    /** Proxy host (DNS name or IP literal). */
    readonly host: string;
    /** Proxy port, 1–65535. */
    readonly port: number;
    /** Proxy username, when the proxy requires authentication. */
    readonly username?: string | undefined;
    /** Proxy password, when the proxy requires authentication. */
    readonly password?: string | undefined;
}

/**
 * The destination requested through the proxy — what the client wants to
 * reach, not the proxy itself.
 */
export interface ProxyTarget {
    /** Target host (DNS name or IP literal). */
    readonly host: string;
    /** Target port, 1–65535. */
    readonly port: number;
}

/**
 * Credentials for proxy authentication.
 *
 * Used verbatim as RFC 1929 username/password (SOCKS5) or Basic auth
 * (HTTP CONNECT). Field length limits are enforced by the handshake, not
 * by this type.
 */
export interface ProxyCredentials {
    readonly username: string;
    readonly password: string;
}

// ===========================================================================
// Cookie jar consumer surface (canonical; @browsercore/cookies satisfies it)
// ===========================================================================

/**
 * `CookieJarConsumer` — the structural minimal surface a cookie-consuming
 * client (fetch) actually needs from a jar.
 *
 * Derived from fetch's real call sites (`fetch/src/client.ts`):
 * `applyCookies` calls `jar.getCookies(url)` to build the Cookie header and
 * `storeCookies` calls `jar.setCookie(raw, url)` per Set-Cookie header —
 * nothing else (no id, no clone, no clear/serialize). `@browsercore/cookies`'
 * full `CookieJar` (with SameSite-context matching, removal, and
 * (de)serialization) satisfies this interface structurally as a strict
 * superset; fetch migrates its `options.cookieJar` onto this type next wave,
 * dropping its direct `@browsercore/cookies` type dependency.
 *
 * Parameter order matches `@browsercore/cookies` (`setCookie(raw, url)`),
 * NOT the legacy full `CookieJar` in `contracts.ts` (whose
 * `setCookie(url, cookie)` order is flipped and reconciled separately).
 */
export interface CookieJarConsumer {
    /**
     * All cookies that match the given URL, ordered per RFC 6265 §5.4
     * (domain/path specificity, earlier-set first).
     */
    getCookies(url: string): readonly Cookie[];
    /** Parse a raw Set-Cookie header value and store the resulting cookie. */
    setCookie(raw: string, url: string): void;
}
