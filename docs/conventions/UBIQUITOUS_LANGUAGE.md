# Ubiquitous language

> **The glossary is law.** Code, docs, commits and screen copy use these words and no synonyms.
> A new term is added here first, in the same commit that introduces it.

## People and roles

| Term | Meaning | In code | Never |
|---|---|---|---|
| **merchant** | Whoever sells. The `authority` of a `SplitConfig`; receives the remainder of every payment | `authority` (on-chain), `merchant` (SDK, API) | owner, seller, store owner |
| **recipient** | A wallet in a `SplitConfig` with its basis points. In the pitch, a recipient is a **partner** or a **platform** | `recipients[i] = { wallet, bps }` | payee, beneficiary, affiliate |
| **partner** · **platform** | Pitch roles of a recipient: a co-owner or partner; a marketplace taking its cut. Not separate types in code | — (both are recipients) | commission earner |
| **payer** | Whoever pays — the customer's wallet | `payer` | buyer, customer (in code) |

## The split

| Term | Meaning | In code |
|---|---|---|
| **split config** | The on-chain account with the mint and up to 4 recipients. One per merchant per `id`; immutable | `SplitConfig`, `config` |
| **bps** | Basis points; 10 000 = 100 % | `bps: u16` |
| **share** | The amount one recipient receives from one payment: `floor(amount × bps / 10 000)` | `shares[i]` |
| **merchant amount** | The remainder after the shares; the rounding leftover goes here | `merchantAmount` / `merchant_amount` |
| **leg** | One transfer inside a payment — a recipient's or the merchant's. A zero leg is skipped | `legs[{ wallet, amount }]` |
| **split payment** | The one transaction that pays every leg | `buildSplitPayment` |
| **strategy** | How a split payment is built: `program` (through `pay`) or `transfers` (one `transfer_checked` per leg) | `strategy: 'program' \| 'transfers'` |
| **base units** | Integer amount in the mint's smallest unit (USDC: 6 decimals) | `bigint` |

## Solana Pay

| Term | Meaning | In code |
|---|---|---|
| **reference** | A fresh public key added to the payment as a readonly account, so the payment can be found by it | `reference` |
| **transaction request** | The Solana Pay flow where the wallet asks an HTTPS endpoint for the transaction | `paymentUrl`, the handler |
| **handler** | The SDK's transaction request endpoint the store hosts | `createTransactionRequestHandler` |
| **resolve** | The store's callback that turns the URL's last segment into `{ config, amount, reference, message }` or an error code | `resolve(key)` |

## Orders, charges, status

| Term | Meaning | In code |
|---|---|---|
| **order** | The demo store's purchase. Lives in a signed **order token**, never in a database | `orderId`, order token |
| **charge** | The hosted service's payment request, created by `POST /v1/charges` | `charges`, `ch_…` |
| **hold** | The first payer to ask for a charge's transaction holds it; anyone else gets `ORDER_HELD` | `payer` column |
| **verifier** | `verifySplitPayment` — judges a transaction by balances against the config and the amount | `verifySplitPayment` |
| **status** | `pending` · `paid` · `paid_late` (landed after expiry, still recorded) · `expired` · `invalid` | `status` |
| **flip** | The conditional `pending → paid` update; only the caller that wins it sends the webhook | `flip` |
| **hosted checkout** | The service's payment page, `/c/:id` | `apps/hosted` |
| **webhook** | The signed event sent to the store once, on the flip. A **delivery** is one attempt | `webhook_deliveries` |

## Plan vocabulary

| Term | Meaning |
|---|---|
| **card** | One unit of work in `docs/planning/tasks/` |
| **the cut** | Sat 02:00 — program not paying on devnet → default strategy `transfers` |
| **the gate** | Sat 14:00 — a phone purchase through the program on devnet, verified |
| **track** | A (Alexandre) or B (the partner) |
