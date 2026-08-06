/**
 * Options — configuration for protocol packages.
 *
 * Each protocol package accepts an options object that implements one of
 * these interfaces. Options are implementation-independent configuration
 * that gets passed down from consumers like browsersmith.
 */

import type {
    Transport,
    DatagramTransport,
    QuicConnection,
    Clock,
    PacketCallback,
    CookieJar,
} from "./contracts.js";
import type { BrowserProfile, UdpAddress } from "./models.js";

// ===========================================================================
// TLS Options
// ===========================================================================

export interface TlsOptions {
    readonly transport: Transport;
    readonly profile: BrowserProfile;
    readonly serverName: string;
    readonly clock?: Clock;
    readonly onPacket?: PacketCallback;
}

// ===========================================================================
// HTTP/1 Options
// ===========================================================================

export interface Http1Options {
    readonly transport: Transport;
    readonly profile: BrowserProfile;
    readonly onPacket?: PacketCallback;
}

// ===========================================================================
// HTTP/2 Options
// ===========================================================================

export interface Http2Options {
    readonly transport: Transport;
    readonly profile: BrowserProfile;
    readonly onPacket?: PacketCallback;
}

// ===========================================================================
// HTTP/3 Options
// ===========================================================================

export interface Http3Options {
    readonly quic: QuicConnection;
    readonly clock?: Clock;
    readonly onPacket?: PacketCallback;
}

// ===========================================================================
// QUIC Options
// ===========================================================================

export interface QuicOptions {
    readonly transport: DatagramTransport;
    readonly peer: UdpAddress;
    readonly serverName: string;
    readonly initialDcid: Uint8Array;
    readonly initialScid: Uint8Array;
    readonly handshakeTimeoutMs?: number;
    readonly clock?: Clock;
    readonly onPacket?: PacketCallback;
}

// ===========================================================================
// Fetch Client Options
// ===========================================================================

export interface FetchClientOptions {
    readonly profile?: BrowserProfile;
    readonly cookieJar?: CookieJar;
    readonly tls?: Partial<TlsOptions>;
    readonly http2?: Partial<Http2Options>;
    readonly http3?: Partial<Http3Options>;
    readonly transport?: Transport;
}
