# Overview

> The shape of the system. The exact interfaces are in [`../CONTRACTS.md`](../CONTRACTS.md);
> scope and ownership in [`../planning/PLAN.md`](../planning/PLAN.md) §3–§4.

## Two layers

| Layer | Pieces | When |
|---|---|---|
| **Open** — the pitch | `bujius_checkout` program · `@bujius/checkout-sdk` · `@bujius/checkout-react` · the demo store, which uses only the SDK | MVP, by the Sat 14:00 gate |
| **Open** | verifiable build, MIT licence, npm `0.1.0` | after the gate |
| **Service** — a convenience on top | `apps/hosted`: charges API, hosted checkout page, signed webhook sent once, Helius trigger, Postgres | after the gate |

The open layer works with **no backend of ours**: any store hosts the SDK's transaction request
handler on its own server.

## The program

One account per merchant per `id`, never one per sale:

- `create_split(id, recipients)` — the merchant writes a `SplitConfig`: the mint and up to 4
  recipients with basis points. Immutable.
- `pay(amount)` — reads the config, moves one `transfer_checked` per recipient and the
  remainder to the merchant, emits `SplitPaid`. Takes the Solana Pay **reference** as a
  readonly account, so the payment can be found by it. Creates no account.

## The payment flow — QR (phone wallet)

```
store backend ──newReference, order token──▶ checkout page shows QR (solana:https://store/api/pay/<token>)
phone wallet ──GET──▶ handler  → { label, icon }
phone wallet ──POST { account }──▶ handler → resolve(token) → buildSplitPayment(strategy)
                                            ← { transaction (base64), message }
phone wallet signs and sends ──▶ devnet: [idempotent ATA creates] + pay  (or + transfer_checked × legs)
checkout page polls status ──▶ findPayment(reference) → verifySplitPayment → paid | paid_late | invalid
```

## The payment flow — connected wallet (desktop)

`PayButton` speaks the same plain Solana Pay transaction request: `POST { account }` to the
handler, deserializes the transaction, asks the extension to sign and send. The browser never
builds the transaction — so the button works against **any** transaction request endpoint,
Bujius Pay's included.

## Two strategies behind one signature

`buildSplitPayment(…, strategy)`:

- `program` — the idempotent creates plus `pay`. The split is enforced on-chain.
- `transfers` — the same creates plus one `transfer_checked` per leg, the reference on the first
  transfer. The fallback if the program is not paying by the Sat 02:00 cut.

The verifier reads **balances, not instructions**, so it judges both strategies the same way.

## Who guarantees what

| Guarantee | By |
|---|---|
| The split follows the merchant's config | the program (`program` strategy) |
| The amount matches the order | the verifier — anyone holding the reference can send another amount |
| Recipients cannot be swapped by a request | the config is on-chain; no route accepts recipients |
| The store hears about a payment once | the conditional `pending → paid` flip; only its winner sends the webhook |

## The demo store has no database

An order is an HMAC-signed token (order id, amount, reference, expiry) riding in the QR's URL;
"paid" is what the verifier finds on-chain. The chain is the source of truth.
