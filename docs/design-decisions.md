# Design Decisions

Recorded rationale for contract-shape decisions that look restrictive at
first glance. Each entry states the decision, why it was made, what it
explicitly rules out, and what revisiting it would cost.

---

## CryptoProvider and CompressionProvider are deliberately synchronous

`CryptoProvider` (`src/contracts.ts`) and `CompressionProvider`
(`src/contracts.ts`) have **100% synchronous operations**. This is a
deliberate speed and architecture choice, not an accident of the first
implementation (replaceability audit 2026-11-16: "Sync Crypto/Compression is
a deliberate speed choice made implicit — either document it honestly or
async-ify"). This document is the honest version. It supersedes the
pre-0.2.5 documentation which *falsely* claimed WebCrypto and
CompressionStream as valid backends; those claims were corrected in 0.2.5
and are restated here as explicit non-goals.

### Why synchronous

1. **The protocol state machines are synchronous.** The TLS record layer,
   HPACK, the QUIC packet protector, and the TLS 1.3 key schedule are written
   as straight-line synchronous transforms over byte buffers. Every
   `encryptRecord` / `decryptRecord` / `hmac` / `hkdf` call sits inside
   record-layer hot paths that already hold parsed state in local variables.
   Making the provider async means making every caller async: an
   async-ified CryptoProvider would ripple on the order of **~40 `await`s
   through record-layer hot paths** (every AEAD open/seal, every transcript
   hash update, every HKDF expansion) — re-entrancy hazards, allocation of
   intermediate promise state per record, and microtask scheduling between
   the state machine and its crypto, in exchange for zero benefit from the
   backends that exist today.

2. **The shipped backends are pure JS and already synchronous.**
   `@browsercore/crypto` is built on the noble libraries
   (`@noble/hashes`, `@noble/ciphers`, `@noble/post-quantum`) — pure
   JavaScript, zero `node:*` imports, synchronous by nature, and covering the
   FULL provider surface including ML-KEM-768 (FIPS 203) and the
   `X25519MLKEM768` hybrid. The Cloudflare Workers feasibility spike
   (2026-11-16) confirmed a sync noble provider satisfies the interface
   as-is on every runtime — Node, Bun, Deno, Workers — with no refactor.

3. **Compression is the same story.** `@browsercore/compression`'s Node
   backend is the synchronous `node:zlib` family; bodies are whole-buffer
   transforms (`decompress(data, encoding)`), not streams. The async
   `encode/decode(ContentEncoding)` shape had zero consumers and was dropped
   in 0.2.5.

### Explicitly NOT valid backends

- **WebCrypto (`crypto.subtle`) cannot implement `CryptoProvider`.** Every
  WebCrypto operation is promise-returning; the interface is sync. A
  "WebCrypto-backed CryptoProvider" would have to block on a microtask
  queue inside a synchronous call — impossible without lieing to the type
  system. The correct backend on any runtime is the noble-based provider
  (which is also FASTER for these buffer-in/buffer-out sizes, and is the
  only way to reach post-quantum hybrids).
- **CompressionStream / DecompressionStream cannot implement
  `CompressionProvider`.** They are async *stream* primitives with no
  one-shot synchronous entry point, and no brotli in all engines. The
  correct backend is the `node:zlib`-style synchronous family (available in
  Workers via `nodejs_compat`).

If a future runtime offers ONLY async primitives for something this
interface needs, that is the trigger to revisit — not a reason to fake a
sync adapter over an async backend.

### What an async future would require

Sized by the Workers feasibility spike and the replaceability audit
(2026-11-16): roughly **two days of mechanical work** —

1. Flip every provider method to `Promise`-returning in this package (one
   interface, but a breaking major for every implementer and consumer).
2. Await-annotate the ~40 sync call sites in the TLS/QUIC record-layer hot
   paths (tls record layer + key schedule, quic header protection + key
   derivation, http2 HPACK where applicable), keeping sequence-number and
   transcript ordering intact.
3. Re-do the performance evaluation for the handshake path (currently
   sub-50 ms pure-JS full handshakes; added microtask hops per record are
   measurable at that scale).
4. Migrate the mock providers and conformance suites in
   `@browsercore/testing`.

It is unnecessary while noble backends exist, so it stays undone. The point
of this note is that the decision is now *written down*: do not "helpfully"
convert these interfaces to async, and do not reintroduce claims that
WebCrypto/CompressionStream are backends.

---

## Platform bundles are optional; capabilities are resolved, not faked

(See `src/platform.ts` and `src/tcp-transport.ts` doc comments for the full
statement.) The all-or-nothing `Platform` forced consumers without a
capability (UDP on Workers, DNS under `socks5h`) to lie to the type system
with stubs. With every bundle optional, the rule is: **a consumer resolves
what it uses and throws a typed error naming the missing capability** — the
pattern `@browsercore/fetch`'s `proxyDialPlatform` established while the
type system still required the fields.

## The canonical Clock supersedes five sibling Clock shapes

(See `src/time.ts`.) tls, http1, http2, http3, and quic each declared a
local, incompatible `Clock`; `TimerHandle` is an opaque `object` precisely so
no runtime's timer token type (`NodeJS.Timeout`, numeric id, disposer) leaks
into published declarations. The five `options.clock` seams migrate onto the
canonical Clock in the next wave.

## TlsHandshakeEngine: contracts is the only protocol-to-protocol channel

(See `src/tls-engine.ts`.) quic's direct import of the tls handshake engine
was the single no-hard-wires violation; the engine interface here is the
fix's landing zone, with http3's fake-quic compatibility test as the
proof-of-concept that a structural engine implementation satisfies the
consumer.
