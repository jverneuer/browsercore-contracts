# @browsercore/contracts

[![npm version](https://img.shields.io/npm/v/@browsercore/contracts)](https://www.npmjs.com/package/@browsercore/contracts)
[![coverage](https://img.shields.io/endpoint?url=https://jverneuer.github.io/browsercore-contracts/badge.json)](https://github.com/jverneuer/browsercore-contracts/blob/main/COVERAGE.md)
[![CI](https://img.shields.io/github/actions/workflow/status/jverneuer/browsercore-contracts/ci.yml?label=CI)](https://github.com/jverneuer/browsercore-contracts/actions/workflows/ci.yml)

The canonical interface package for the browsercore stack. Every protocol
package, runtime adapter, and consumer depends on these contracts — they
define how components communicate without coupling them to each other.

## Why this package exists

**Zero drift through global interface distribution.** Without a shared
contracts package, every `@browsercore/*` package would define its own version
of `Transport`, `BrowserProfile`, `FetchClient`, etc. When one package changes
a shape, the others silently break at runtime. By centralizing every
cross-package interface here, a type error becomes a compile error the moment
any package diverges.

**Alternative implementations welcome.** The contracts define exactly what a
component must satisfy — nothing more. Want to write a different TLS engine?
Implement `TlsConnection`. A different transport? Implement `Transport`. A
different runtime (Bun, Deno, Workers)? Implement `Net` and `DnsResolver`. The
contracts are the spec; the packages are the reference implementations.

**Implementation-independent.** No `node:crypto`, `node:net`, `Buffer`, or any
runtime details leak into these types. They are portable TypeScript interfaces
and plain data.

## Architecture

```
@browsercore/contracts (this package — interfaces + models + wire codes)
         ▲
         │
  ┌──────┼─────────────┐
  │      │             │
  ▼      ▼             ▼
 tls    http2       transport
  │       │             │
  └───────┴─────────────┘
          ▼
    @browsercore/fetch
          ▼
    browsersmith (entrypoint)
```

Dependency direction is strictly upward — contracts is the root dependency.
No package below contracts in the graph; every other package imports from it.

## What's inside

| Module | Purpose | Key exports |
|---|---|---|
| **Contracts** | Provider + connection interfaces that protocol packages implement | `CryptoProvider`, `CompressionProvider`, `Transport`, `DatagramTransport`, `TlsConnection`, `Http1Connection`, `Http2Connection`, `Http3Connection`, `QuicConnection`, `QuicStream`, `FetchClient`, `CookieJar`, `Clock`, `PacketCallback` |
| **Models** | Shared data structures that cross package boundaries | `BrowserProfile`, `TlsProfile`, `Http1Profile`, `Http2Profile`, `Request`, `Response`, `Headers`, `Cookie`, `TransportState`, `CloseReason`, `ContentEncoding` |
| **Net** | Platform-agnostic TCP + DNS contracts for runtime portability | `Net`, `DnsResolver`, `Socket`, `ConnectOptions`, `IPAddress` |
| **Options** | Configuration objects passed to each protocol package | `TlsOptions`, `Http1Options`, `Http2Options`, `Http3Options`, `QuicOptions`, `FetchClientOptions` |
| **IANA Tables** | Canonical TLS wire code lookup tables (single source of truth) | `CIPHER_SUITE_CODES`, `NAMED_GROUP_CODES`, `SIGNATURE_SCHEME_CODES`, `VERSION_CODES` |

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
   *"Could two packages reasonably import this type?"* If yes → contracts.
   If only one package uses it → stays in that package.

2. **No runtime behavior.** Only TypeScript types and `const` data tables.
   No classes with logic, no functions with side effects.

3. **No Node built-ins.** Types reference only portable primitives:
   `string`, `number`, `Uint8Array`, `Promise`, `IterableIterator`.

4. **Branded types for IDs.** `ProfileId`, `StreamId`, `ConnectionId` etc.
   are opaque branded types, not bare `string`/`number`.

5. **Discriminated unions for state.** `TransportState`, `CloseReason`,
   `TlsState` model every valid state explicitly — invalid combinations
   are unrepresentable.

## Zero overhead

All type exports are erased by the TypeScript compiler. The only runtime
exports are the IANA wire code tables — plain `const` objects with no
dependencies, no side effects.
