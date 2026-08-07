# @browsercore/contracts

[![npm version](https://img.shields.io/npm/v/@browsercore/contracts)](https://www.npmjs.com/package/@browsercore/contracts)
[![coverage](https://img.shields.io/endpoint?url=https://jverneuer.github.io/browsercore-contracts/badge.json)](https://github.com/jverneuer/browsercore-contracts/blob/main/COVERAGE.md)
[![CI](https://img.shields.io/github/actions/workflow/status/jverneuer/browsercore-contracts/ci.yml?label=CI)](https://github.com/jverneuer/browsercore-contracts/actions/workflows/ci.yml)

Shared interfaces, models, and options for the browsercore stack. Zero runtime
dependencies — pure TypeScript types and IANA wire code tables that every
`@browsercore/*` package agrees on.

## Purpose

This package defines every type that governs how browsercore components
communicate. It is implementation-independent: no `node:crypto`, `node:net`,
`Buffer`, or any runtime details.

**Litmus test:** *"Could another package reasonably import this type?"*
If yes → belongs here. If only one protocol touches it → stays in that package.

## Architecture

```
@browsercore/contracts (this package — shared types + wire codes)
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

## What's inside

| Module | Exports |
|---|---|
| **Contracts** | `CryptoProvider`, `CompressionProvider`, `Transport`, `DatagramTransport`, `TlsConnection`, `Http1Connection`, `Http2Connection`, `Http3Connection`, `QuicConnection`, `QuicStream`, `FetchClient`, `CookieJar`, `Clock`, `PacketCallback` |
| **Models** | `BrowserProfile`, `TlsProfile`, `Http1Profile`, `Http2Profile`, `Request`, `Response`, `Headers`, `Cookie`, `TransportState`, `CloseReason`, `ContentEncoding` |
| **Net** | `Net`, `DnsResolver`, `Socket`, `ConnectOptions`, `IPAddress` — platform-agnostic TCP + DNS |
| **Options** | `TlsOptions`, `Http1Options`, `Http2Options`, `Http3Options`, `QuicOptions`, `FetchClientOptions` |
| **IANA Tables** | `CIPHER_SUITE_CODES`, `NAMED_GROUP_CODES`, `SIGNATURE_SCHEME_CODES`, `VERSION_CODES` |

## Usage

```ts
import type { Net, DnsResolver, Transport } from "@browsercore/contracts";
import { CIPHER_SUITE_CODES } from "@browsercore/contracts";

// Look up a cipher suite wire code
const aes128 = CIPHER_SUITE_CODES["TLS_AES_128_GCM_SHA256"]; // 0x1301
```

## Zero overhead

All exports are TypeScript types (erased at compile time) except the IANA wire
code tables, which are plain `const` objects. No runtime behavior, no side
effects, no dependencies.
