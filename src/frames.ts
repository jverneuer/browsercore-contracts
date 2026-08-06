/**
 * Protocol frame types for packet inspection.
 *
 * These types define the shape of frames that protocol packages emit when
 * an `onPacket` callback is provided in their options. Each protocol extends
 * the base {@link ProtocolFrame} with protocol-specific fields.
 */

// ---------------------------------------------------------------------------
// Base frame
// ---------------------------------------------------------------------------

/** Direction of a protocol frame. */
export type PacketDirection = "sent" | "received";

/**
 * Base protocol frame — the common shape every frame variant extends.
 *
 * Emitted by protocol packages when packet inspection is enabled via
 * the `onPacket` callback in their options.
 */
export interface ProtocolFrame {
    /** Protocol that emitted this frame. */
    readonly protocol: string;
    /** Whether this frame was sent or received. */
    readonly direction: PacketDirection;
    /** Timestamp (ms since epoch) when the frame was captured. */
    readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// TLS frame
// ---------------------------------------------------------------------------

/** TLS record content-type identifiers (RFC 8446 §6). */
export const TlsContentType = {
    CHANGE_CIPHER_SPEC: 20,
    ALERT: 21,
    HANDSHAKE: 22,
    APPLICATION_DATA: 23,
    HEARTBEAT: 24, // RFC 6520
} as const;

export type TlsContentTypeValue = (typeof TlsContentType)[keyof typeof TlsContentType];

/** TLS handshake message types (RFC 8446 §4). */
export const TlsHandshakeType = {
    CLIENT_HELLO: 1,
    SERVER_HELLO: 2,
    NEW_SESSION_TICKET: 4,
    END_OF_EARLY_DATA: 5,
    ENCRYPTED_EXTENSIONS: 8,
    CERTIFICATE: 11,
    CERTIFICATE_REQUEST: 13,
    CERTIFICATE_VERIFY: 15,
    FINISHED: 20,
    KEY_UPDATE: 24,
    MESSAGE_HASH: 254,
} as const;

export type TlsHandshakeTypeValue = (typeof TlsHandshakeType)[keyof typeof TlsHandshakeType];

/**
 * Decoded TLS record header (RFC 8446 §5.2).
 */
export interface TlsRecordHeader {
    /** Content type of the record. */
    readonly type: TlsContentTypeValue;
    /** Protocol version (legacy_version field). */
    readonly version: number;
    /** Length of the fragment in bytes. */
    readonly length: number;
}

/**
 * TLS-specific frame — emitted for each TLS record.
 */
export interface TlsFrame extends ProtocolFrame {
    readonly protocol: "tls";
    /** Decoded record header. */
    readonly header: TlsRecordHeader;
    /** The raw record bytes (header + fragment). */
    readonly bytes: Uint8Array;
    /** Decoded fragment, if available. */
    readonly fragment?: unknown;
}

// ---------------------------------------------------------------------------
// HTTP/2 frame
// ---------------------------------------------------------------------------

/** HTTP/2 frame type identifiers (RFC 9113 §11.2). */
export const Http2FrameType = {
    DATA: 0x0,
    HEADERS: 0x1,
    PRIORITY: 0x2,
    RST_STREAM: 0x3,
    SETTINGS: 0x4,
    PUSH_PROMISE: 0x5,
    PING: 0x6,
    GOAWAY: 0x7,
    WINDOW_UPDATE: 0x8,
    CONTINUATION: 0x9,
} as const;

export type Http2FrameTypeValue = (typeof Http2FrameType)[keyof typeof Http2FrameType];

/**
 * Decoded HTTP/2 frame header (RFC 9113 §4.1).
 */
export interface Http2FrameHeader {
    /** Frame type. */
    readonly type: Http2FrameTypeValue;
    /** Flags byte. */
    readonly flags: number;
    /** Stream identifier. */
    readonly streamId: number;
    /** Payload length. */
    readonly length: number;
}

/**
 * HTTP/2-specific frame — emitted for each HTTP/2 frame.
 */
export interface Http2Frame extends ProtocolFrame {
    readonly protocol: "http2";
    /** Decoded frame header. */
    readonly header: Http2FrameHeader;
    /** The raw frame bytes (header + payload). */
    readonly bytes: Uint8Array;
    /** Decoded payload, if available. */
    readonly payload?: unknown;
}

// ---------------------------------------------------------------------------
// HTTP/3 frame
// ---------------------------------------------------------------------------

/** HTTP/3 frame type identifiers (RFC 9114 §7.2). */
export const Http3FrameType = {
    DATA: 0x0,
    HEADERS: 0x1,
    CANCEL_PUSH: 0x3,
    SETTINGS: 0x4,
    PUSH_PROMISE: 0x5,
    GOAWAY: 0x7,
    MAX_PUSH_ID: 0x0d,
} as const;

export type Http3FrameTypeValue = (typeof Http3FrameType)[keyof typeof Http3FrameType];

/**
 * HTTP/3-specific frame — emitted for each HTTP/3 frame.
 */
export interface Http3Frame extends ProtocolFrame {
    readonly protocol: "http3";
    /** Frame type. */
    readonly type: Http3FrameTypeValue;
    /** The raw frame bytes (header + payload). */
    readonly bytes: Uint8Array;
    /** Decoded payload, if available. */
    readonly payload?: unknown;
}

// ---------------------------------------------------------------------------
// QUIC frame
// ---------------------------------------------------------------------------

/** QUIC long packet type identifiers (RFC 9000 §17.2). */
export const QuicLongPacketType = {
    INITIAL: 0b00,
    ZERO_RTT: 0b01,
    HANDSHAKE: 0b10,
    RETRY: 0b11,
} as const;

export type QuicLongPacketTypeValue = (typeof QuicLongPacketType)[keyof typeof QuicLongPacketType];

/**
 * QUIC-specific frame — emitted for each QUIC packet.
 */
export interface QuicFrame extends ProtocolFrame {
    readonly protocol: "quic";
    /** True if this is a long-header packet. */
    readonly longHeader: boolean;
    /** Long packet type (only for long headers). */
    readonly packetType?: QuicLongPacketTypeValue;
    /** QUIC version. */
    readonly version?: number;
    /** The raw packet bytes. */
    readonly bytes: Uint8Array;
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

/**
 * Every protocol frame variant — discriminated by `protocol`.
 *
 * Use a switch on `protocol` to narrow to the specific frame type:
 *
 * ```ts
 * switch (frame.protocol) {
 *     case "tls": // frame is TlsFrame
 *     case "http2": // frame is Http2Frame
 *     case "http3": // frame is Http3Frame
 *     case "quic": // frame is QuicFrame
 * }
 * ```
 */
export type AnyFrame = TlsFrame | Http2Frame | Http3Frame | QuicFrame;
