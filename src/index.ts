/**
 * @browsercore/core — shared interfaces and packet inspection types.
 *
 * This package defines:
 * - {@link ProtocolFrame} and its variants (TlsFrame, Http2Frame, etc.)
 * - {@link PacketCallback} for packet inspection
 * - {@link PacketInspectionOptions} mixin for protocol package options
 *
 * The core package has zero runtime dependencies and is safe to import
 * from any layer without creating circular dependencies.
 */

// Frame types
export type {
    ProtocolFrame,
    PacketDirection,
    TlsFrame,
    TlsRecordHeader,
    Http2Frame,
    Http2FrameHeader,
    Http3Frame,
    QuicFrame,
    AnyFrame,
} from "./frames.js";

export {
    TlsContentType,
    TlsHandshakeType,
    Http2FrameType,
    Http3FrameType,
    QuicLongPacketType,
} from "./frames.js";

export type {
    TlsContentTypeValue,
    TlsHandshakeTypeValue,
    Http2FrameTypeValue,
    Http3FrameTypeValue,
    QuicLongPacketTypeValue,
} from "./frames.js";

// Packet inspection
export type { PacketCallback, PacketInspectionOptions } from "./callback.js";
export { noopPacketCallback } from "./callback.js";
