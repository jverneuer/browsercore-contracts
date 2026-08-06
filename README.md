# @browsercore/api
[![coverage](https://img.shields.io/endpoint?url=https://jverneuer.github.io/browsercore-api/badge.json)](https://github.com/jverneuer/browsercore-api)

Shared interfaces and packet inspection types for the browsercore stack.

## Purpose

This package defines the frame types and callback interfaces that protocol packages use to emit packet inspection data. It has **zero runtime dependencies** and is safe to import from any layer.

## Frame Types

| Frame Type | Protocol | Extends |
|------------|----------|---------|
| `TlsFrame` | `"tls"` | `ProtocolFrame` |
| `Http2Frame` | `"http2"` | `ProtocolFrame` |
| `Http3Frame` | `"http3"` | `ProtocolFrame` |
| `QuicFrame` | `"quic"` | `ProtocolFrame` |

All frame types are discriminated by the `protocol` field.

## Usage in Protocol Packages

Add the `onPacket` callback to your options:

```typescript
import type { PacketCallback, PacketInspectionOptions } from "@browsercore/api";

interface MyOptions {
    // ... existing options
    readonly onPacket?: PacketCallback;
}

async function connect(options: MyOptions) {
    // Emit frames when callback is set
    if (options.onPacket) {
        options.onPacket({
            protocol: "tls",
            direction: "sent",
            timestamp: Date.now(),
            // ... protocol-specific fields
        });
    }
}
```

## Usage in Consumers (e.g., browsersmith)

```typescript
import { createInspectorSession } from "@browsercore/devtools";
import type { PacketCallback } from "@browsercore/api";

const session = createInspectorSession();

// Create a callback that feeds the inspector
const onPacket: PacketCallback = (frame) => session.addFrame(frame);

// Pass to all protocol packages
const client = createClient({
    tls: { onPacket },
    http2: { onPacket },
    http3: { onPacket },
});
```

## Zero Overhead

When `onPacket` is undefined (the default), protocol packages skip frame emission entirely. The guard `if (options.onPacket)` is a single branch with negligible cost.
