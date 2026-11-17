# @browsercore/contracts

[![npm version](https://img.shields.io/npm/v/@browsercore/contracts)](https://www.npmjs.com/package/@browsercore/contracts)
[![coverage](https://img.shields.io/endpoint?url=https://jverneuer.github.io/browsercore-contracts/badge.json)](https://github.com/jverneuer/browsercore-contracts/blob/main/COVERAGE.md)
[![CI](https://img.shields.io/github/actions/workflow/status/jverneuer/browsercore-contracts/ci.yml?label=CI)](https://github.com/jverneuer/browsercore-contracts/actions/workflows/ci.yml)

The canonical interface package for the browsercore stack. Every protocol
package, runtime adapter, and consumer depends on these contracts — they
define how components communicate without coupling them to each other. As of
0.2.5 this is the canonical single definition for `Transport`,
`CryptoProvider`, and `CompressionProvider` (the implementing packages
re-export them), plus the `Platform` service contracts (events, time,
telemetry, network). A few deliberately package-local surfaces remain
duplicated (e.g. `CookieJar`, per-package `Clock` shapes) — converging them is
tracked separately.

## Why this package exists

**Zero drift through global interface distribution.** Without a shared
contracts package, every `@browsercore/*` package would define its own version
of `Transport`, `BrowserProfile`, `FetchClient`, etc. When one package changes
a shape, the others silently break at runtime. By centralizing every
cross-package interface here, a type error becomes a compile error the moment
any package diverges.

**Alternative implementations welcome.** The contracts define exactly what a
component must satisfy — nothing more. Want to write a different transport?
Implement `Transport`. A different crypto backend? Implement
`CryptoProvider` (synchronous — WebCrypto cannot satisfy it). A
different runtime (Bun, Deno, Workers)? Implement the `Platform` service
interfaces. The contracts are the spec; the packages are the reference
implementations.

**Implementation-independent.** No `node:crypto`, `node:net`, `Buffer`, or any
runtime details leak into these types. They are portable TypeScript interfaces
and plain data.

## Architecture

```
@browsercore/contracts (this package — interfaces + services + models)
         ▲
         │
  ┌──────┼─────────────────────────────┐
  │      │                             │
  ▼      ▼                             ▼
transport   tls   http1   http2   http3   quic   fetch   crypto   compression
  │         │      │       │       │       │       │        │         │
  └─────────┴──────┴───────┴───────┴───────┴───────┴────────┴─────────┘
                                    ▼
                           browsersmith (composition root — builds Platform)
```

Dependency direction is strictly upward — contracts is the root dependency.
`browsersmith` is the **only** package allowed `node:*` imports; it builds a
`Platform` object that threads runtime capabilities (network, crypto,
compression, events, telemetry, time) down through options.

## What's inside

| Module | Purpose | Key exports |
|---|---|---|
| **Contracts** | Canonical provider interfaces — the single definitions the implementing packages re-export | `CryptoProvider`, `CompressionProvider`, `Transport`, `DatagramTransport`, `CookieJar`, `PacketCallback` |
| **Platform** | The composition root + per-service bundles | `Platform`, `PlatformOptions`, `Network`, `Crypto`, `Compression` |
| **Events** | Structural emitter interface (a method surface, **not** EventTarget-backed) injected via `Platform.events` | `EventProvider`, `TypedEventEmitter<T>` |
| **Time** | Clock + scheduler with composable deadlines | `Clock`, `Duration`, `Scheduler`, `Deadline`, `Time` |
| **Telemetry** | OTel-aligned observability | `Logger`, `Tracer`, `Span`, `Metrics`, `Telemetry` |
| **Models** | Shared data structures that cross package boundaries | `BrowserProfile`, `TlsProfile`, `Http1Profile`, `Http2Profile`, `Request`, `Response`, `Headers`, `Cookie`, `TransportState`, `CloseReason`, `ContentEncoding` |
| **Net** | Platform-agnostic TCP + DNS contracts for runtime portability | `Net`, `DnsResolver`, `Socket`, `ConnectOptions`, `IPAddress` |
| **IANA Tables** | Canonical TLS wire code lookup tables (single source of truth) | `CIPHER_SUITE_CODES`, `NAMED_GROUP_CODES`, `SIGNATURE_SCHEME_CODES`, `VERSION_CODES` |

The former "Protocol Connection Contracts" (`TlsConnection`, `Http1Connection`,
`Http2Connection`, `Http3Connection`, `QuicConnection`, `QuicStream`,
`FetchClient`) and the Options layer (`TlsOptions` … `FetchClientOptions`) were
removed in 0.2.5: they had zero consumers — every consumer binds the
implementation-local types exported by the protocol packages themselves
(replaceability audit, 2026-11-16). `Transport` and `CryptoProvider` here are
now the canonical single definitions that `@browsercore/transport` and
`@browsercore/crypto` re-export.

## Usage

### Importing types (compile-time only)

```ts
import type { Net, DnsResolver, Transport, BrowserProfile } from "@browsercore/contracts";
```

Type imports are erased at compile time — zero runtime cost.

### Importing wire code tables (runtime)

```ts
import { CIPHER_SUITE_CODES, NAMED_GROUP_CODES } from "@browsercore/contracts";

const aes128 = CIPHER_SUITE_CODES["TLS_AES_128_GCM_SHA256"]; // 0x1301
const x25519 = NAMED_GROUP_CODES["x25519"];                  // 0x001d
```

### Implementing an alternative package

```ts
import type { Transport, TransportState, CloseReason } from "@browsercore/contracts";

class MyCustomTransport implements Transport {
    // Implement the interface — the rest of the stack works unchanged
}
```

## Design rules

1. **If a type crosses a package boundary, it lives here.** Litmus test:
   *"Could someone build an alternative package against it?"* If yes →
   contracts. If only one package uses it → stays in that package.

2. **No runtime behavior.** Only TypeScript types and `const` data tables.
   No classes with logic, no functions with side effects.

3. **No Node built-ins.** Types reference only portable primitives:
   `string`, `number`, `Uint8Array`, `Promise`, `IterableIterator`.

4. **Branded types live in the implementing packages.** Opaque ID brands
   (`TransportId` in transport, `ConnectionId` in quic, `CryptoSessionId` in
   crypto) are defined per-package and stay assignable to the plain
   `string`/`number` fields here. Contracts itself ships plain aliases —
   `ProfileId` is a plain `string`, not a brand.

5. **Discriminated unions for state.** `TransportState`, `CloseReason`,
   `TlsState` model every valid state explicitly — invalid combinations
   are unrepresentable.

## Zero overhead

All type exports are erased by the TypeScript compiler. The only runtime
exports are the IANA wire code tables and `Duration` factories — plain
`const` objects with no dependencies, no side effects.

## Contributing

Contributions are welcome — bug reports, reproductions, docs and code alike. Start with [CONTRIBUTING.md](CONTRIBUTING.md); the full guide lives in the [browsersmith repo](https://github.com/jverneuer/browsersmith/blob/main/CONTRIBUTING.md). First timer? Check the [`good first issue`](https://github.com/jverneuer/browsercore-contracts/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) label. Security issues: [SECURITY.md](SECURITY.md), never a public issue.
