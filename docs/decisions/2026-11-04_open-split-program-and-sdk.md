## Decision: An open split program and SDK as the MVP

**Date:** 2026-11-04 (revalidated 2026-11-05)  
**Status:** accepted  
**Author:** Alexandre, with the partner

---

## Context

The MLH Solana Hackathon's Top 3 asks for "a working product that uses Solana for something it's
good at", not "a chain bolted onto a web2 app". A checkout that only builds Solana Pay transfers
on a server is close to the second. The team has two developers and 48 hours, devnet only.

---

## Options considered

| Option | Pros | Cons |
|-------|------|---------|
| Server-built Solana Pay checkout, no program | fastest; `@solana/pay` does most of it | the split is whatever the server chose; nothing on-chain to audit |
| Per-sale affiliate program (an earner chosen per order) | richer product | one account per person, an earner per sale — does not fit 48 h |
| **Open program with a fixed `SplitConfig` + open SDK** | the split is enforced and auditable on-chain; reusable primitive; fits developer-tooling and public-good framing | a program to write, deploy and test in a weekend |

---

## Decision

> **Open program with a fixed `SplitConfig`, plus an open SDK, as the MVP**

The pitch is the primitive: an atomic split at the moment of sale, with rules the partner audits
on-chain, ready for checkout and point of sale. Never "nobody did this" — Metaplex Hydra already
splits funds on Solana (it accumulates and fans out later).

The decisions that shape it:

1. **Deploy Friday night, on devnet.** A transaction request needs a public HTTPS endpoint the
   phone can reach; localhost cannot test the QR path.
2. **Confirmation: status polling first, a Helius webhook as the trigger** (after the gate). A
   serverless app has no background worker; polling keeps the demo independent of the indexer.
3. **The verifier is custom.** `validateTransfer` from `@solana/pay` checks one recipient and one
   amount; the verifier compares pre/post token balances per leg.
4. **The store webhook fires once** — the conditional `pending → paid` flip; only the caller
   that wins it sends.
5. **Two layers.** Open (program, SDK, components, demo store) is the MVP by the Sat 14:00 gate;
   the service (charges API, hosted checkout, webhook, Helius, database) comes after it.
6. **Revalidation (2026-11-05):** the `SplitConfig` is fixed and sold as a platform/partner split
   (marketplace fee, partner, co-owner) — the per-sale affiliate is a stretch row · the program
   guarantees the split, the verifier guarantees the amount · the pay button speaks the plain
   Solana Pay transaction request, so it works against any compliant endpoint.

Smaller points: `openCheckout` redirects (a modal comes later) · webhook redelivery is a manual
resend · a payment after expiry is recorded as `paid_late`, not ignored · who gets paid never
comes from a request.

---

## Consequences

**Positive:**
- The split shows on the explorer in the video, enforced by a program anyone can read.
- The SDK interface does not care what is underneath: if the program is not paying by the Sat
  02:00 cut, `transfers` takes over and the weekend survives.

**Negative / trade-offs:**
- No account per sale: anyone holding the reference can send another amount — the verifier, not
  the program, catches it.
- A fixed config cannot express a per-sale affiliate.

**Impact on the code:**
- `programs/bujius-checkout`, `packages/sdk`, `packages/react`, `apps/demo-store`; `apps/hosted`
  after the gate.

---

## Future review

After the event: editing and closing a config, a platform fee, several mints, the per-sale
affiliate.
