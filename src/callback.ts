/**
 * Packet inspection callback types.
 *
 * Protocol packages accept an optional `onPacket` callback in their options.
 * When set, the package emits a frame for every packet sent or received.
 * When undefined, no frames are emitted (zero overhead).
 */

import type { AnyFrame, ProtocolFrame } from "./frames.js";

/**
 * Callback invoked for each protocol frame.
 *
 * @param frame - The captured frame. Shape depends on the protocol that emitted it.
 */
export type PacketCallback = (frame: AnyFrame) => void;

/**
 * Options mixin that adds packet inspection to any protocol package.
 *
 * Include this in a package's options interface to enable packet inspection:
 *
 * ```ts
 * interface MyOptions {
 *     // ... other options
 *     readonly onPacket?: PacketCallback;
 * }
 * ```
 */
export interface PacketInspectionOptions {
    /**
     * Callback invoked for each protocol frame sent or received.
     * When undefined, no frames are emitted (zero overhead).
     */
    readonly onPacket?: PacketCallback;
}

/**
 * No-op packet callback — used when inspection is disabled.
 *
 * This is a constant to avoid creating a new function for each frame
 * when inspection is not needed.
 */
export const noopPacketCallback: PacketCallback = () => {};
