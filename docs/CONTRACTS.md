# Bujius Checkout — the contracts

> The interfaces both tracks build against, frozen at the Fri 14:45 sync point
> ([`planning/PLAN.md`](planning/PLAN.md) §8). Prose and tables only — the code lives in the
> packages. A change here is agreed by message first and lands in the same commit as the code
> that needs it (`PLAN.md` §6).

---

## 1. The program — `bujius_checkout`

Program id: generated at `A1` (`anchor keys sync`), recorded in `Anchor.toml`, `declare_id!`
and the SDK's `program/idl.json` — the three always agree.

### `SplitConfig` — one per merchant per `id`, never one per sale

| Field | Type | Bytes |
|---|---|---|
| `authority` | Pubkey — the merchant; receives the remainder | 32 |
| `id` | u16 — lets one merchant hold several configs | 2 |
| `mint` | Pubkey — a classic SPL Token mint (Token-2022 out of scope) | 32 |
| `recipients` | Vec of `{ wallet: Pubkey, bps: u16 }`, at most **4** | 4 + 4 × 34 |
| `bump` | u8 | 1 |

Space: 8 (discriminator) + 32 + 2 + 32 + 140 + 1 = **215 bytes**. Seeds:
`["split", authority, id as u16 little-endian]`. **Immutable in the MVP** — no update, no
close. A partner can trust terms that cannot change under them; editing and closing are a
stretch row.

### `create_split(id: u16, recipients: Vec<Recipient>)`

| # | Account | Constraint |
|---|---|---|
| 0 | `authority` | signer, writable — pays the rent |
| 1 | `config` | init, PDA from the seeds above |
| 2 | `mint` | a `Mint` owned by the classic Token program |
| 3 | `system_program` | |

| Check | Error |
|---|---|
| 1 ≤ `recipients.len()` ≤ 4 | `InvalidRecipientCount` |
| every `bps` ≥ 1 | `ZeroBps` |
| Σ `bps` ≤ 10 000 | `SplitOverflow` |
| wallets distinct, none equal to `authority` | `DuplicateRecipient` |

Emits `SplitCreated { config, authority, mint, recipients }`.

### `pay(amount: u64)`

| # | Account | Constraint |
|---|---|---|
| 0 | `payer` | signer |
| 1 | `payer_token` | writable token account, mint = `config.mint`, owner = `payer` |
| 2 | `config` | `SplitConfig` |
| 3 | `mint` | = `config.mint` |
| 4 | `merchant_token` | writable, = ATA(`config.authority`, `mint`) |
| 5 | `reference` | readonly, **not a signer**, unchecked — the Solana Pay reference |
| 6 | `token_program` | classic Token |
| rest | `remaining_accounts` | writable, ATA(`recipients[i].wallet`, `mint`), **in `config.recipients` order** |

| Check | Error |
|---|---|
| `amount` > 0 | `ZeroAmount` |
| `mint` = `config.mint` | `MintMismatch` |
| `merchant_token` = ATA(authority, mint) | `BadTokenAccount` |
| remaining accounts count = `recipients.len()` | `RecipientCountMismatch` |
| remaining account *i* = ATA(`recipients[i].wallet`, mint) | `BadTokenAccount` |
| any arithmetic overflow | `MathOverflow` |

Moves: one `transfer_checked` from `payer_token` to each recipient's ATA, then one for the
remainder to `merchant_token`. A zero leg is skipped. Emits
`SplitPaid { config, payer, mint, reference, amount, merchant_amount, shares: Vec<u64>, ts }`.

**The program creates no account in `pay`** — token accounts that do not exist are created
by the transaction builder with `create_associated_token_account_idempotent`, paid by the
payer; `create_split`'s builder creates all of them up front, paid by the merchant.

**Byte budget:** a transaction is at most 1232 bytes. `A3` measures `pay` with 4 recipients
and every destination missing (the worst case). The builders only add an idempotent create
for a destination that does not exist.

---

## 2. The split math — one rule, three implementations

The program (`A2`), the SDK's `computeSplit` (`B1`) and the verifier (`A5`) apply the same
rule, and all three test the same vectors:

- intermediate products in 128 bits; `share[i] = floor(amount × bps[i] / 10 000)`
- `merchant = amount − Σ share[i]` — the rounding leftover goes to the merchant, no unit lost
- invariant: `merchant + Σ share = amount`, always

| `amount` (base units) | `bps` | `shares` | `merchant` |
|---|---|---|---|
| 1 000 000 | [500] | [50 000] | 950 000 |
| 1 000 001 | [333, 333] | [33 300, 33 300] | 933 401 |
| 1 | [500] | [0] — leg skipped | 1 |
| 10 000 | [10 000] | [10 000] | 0 — leg skipped |
| 18 446 744 073 709 551 615 | [10 000] | [18 446 744 073 709 551 615] | 0 |

Amounts are integers in base units end to end (USDC: 6 decimals). Decimal strings exist only
at the edges — an API body, a screen. **A float never holds money.**

---

## 3. The SDK — `@bujius/checkout-sdk`

Works in Node and in the browser. Errors are typed codes, never sentences.

| Export | Takes | Returns | Owner |
|---|---|---|---|
| `toBaseUnits` / `fromBaseUnits` | decimal string + decimals / bigint + decimals | bigint / decimal string | B |
| `newReference` | — | a fresh `PublicKey` | B |
| `paymentUrl` | the handler's HTTPS URL | the `solana:` transaction request URL | B |
| `computeSplit` | amount (bigint), recipients' bps | `{ shares: bigint[], merchant: bigint }` | B |
| `buildSplitPayment` | connection, config (with its address), payer, amount, reference, `strategy` | an unsigned legacy `Transaction`, fee payer = payer, blockhash at `confirmed` | B (`transfers`) · A (`program`) |
| `createTransactionRequestHandler` | §4's options | `(request: Request) => Promise<Response>` | B |
| `findSplitConfig` | authority, id | the config's address | A |
| `fetchSplitConfig` | connection, address | `{ address, authority, id, mint, recipients[{ wallet, bps }] }` | A |
| `buildCreateSplit` | connection, authority, id, mint, recipients | an unsigned `Transaction` — creates every destination ATA, then `create_split` | A |
| `findPayment` | connection, reference | the first successful signature at `confirmed`, or `null` | A |
| `findPayments` | connection, reference | every successful signature at `confirmed`, earliest first — so a wrong amount sent first does not hide the right payment | A |
| `verifySplitPayment` | connection, signature, config, amount, reference, `expiresAt?` | `{ status: 'paid' \| 'paid_late' \| 'invalid', reason?, legs[{ wallet, amount }] }` | A |
| `BujiusCheckoutError` + `ErrorCode` | — | the codes below | A0 creates, each owner appends |

**`strategy`:** `'program'` builds the idempotent ATA creates plus `pay`. `'transfers'`
builds the same creates plus one `transfer_checked` per leg, the reference added as a
readonly non-signer key on the first transfer (the Solana Pay convention). The default comes
from the caller; after the Sat 02:00 cut it is whichever one passed `smoke`.

**`verifySplitPayment`** works for both strategies, because it reads balances, not
instructions: the transaction succeeded · the reference is among its account keys · the mint
is `config.mint` · the pre/post token balance of the merchant's ATA and of each recipient's
ATA rose by exactly `computeSplit(amount)` · `blockTime` after `expiresAt` → `paid_late`.
Any other mismatch → `invalid` with the reason. **The program guarantees the split; the
verifier guarantees the amount** — anyone holding the reference can send another amount.

**`ErrorCode`:** `ORDER_NOT_FOUND` · `ORDER_EXPIRED` · `ORDER_PAID` · `ORDER_HELD` ·
`INVALID_ACCOUNT` · `INVALID_AMOUNT` · `CONFIG_NOT_FOUND` · `RPC_UNAVAILABLE`.

---

## 4. The transaction request — HTTP

`createTransactionRequestHandler({ connection, label, iconUrl, strategy, resolve })`.
`resolve(key, account)` gets the last path segment of the request URL and the payer's parsed
account, and returns either `{ config, amount, reference, message }` or `{ error: ErrorCode }`.
A `resolve` with no hold ignores `account`. The account is read first: a malformed one gets `400`
without reaching `resolve`.

| Request | Response |
|---|---|
| `OPTIONS` | `204`, CORS headers |
| `GET` | `200 { label, icon }` — `icon` is absolute HTTPS, reachable without a session |
| `POST { account }` | `200 { transaction: base64, message }` — serialized without requiring all signatures |

Every response carries `Access-Control-Allow-Origin: *`,
`Access-Control-Allow-Methods: GET, POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`.
**Without the preflight answer the wallet fails silently** and the QR does nothing.

Errors use the spec's envelope, `{ "error": "<sentence>" }` — the wallet shows the sentence:

| Code | Status | Sentence (payer-facing, English) |
|---|---|---|
| `INVALID_ACCOUNT` | 400 | "We could not read your account. Try again." |
| `ORDER_NOT_FOUND` | 404 | "This order does not exist." |
| `ORDER_HELD` | 409 | "Someone else is already paying this order." |
| `ORDER_PAID` | 409 | "This order is already paid." |
| `ORDER_EXPIRED` | 410 | "This order expired. Go back to the store and start again." |
| `RPC_UNAVAILABLE` | 503 | "The network is busy. Try again in a moment." |
| any other error | 500 | "This order cannot be paid. Go back to the store." |

A method other than `GET`, `POST` or `OPTIONS` gets `405` and "This request is not supported."

### The demo store's routes (no database)

**Order token:** `base64url(JSON { v: 1, o: orderId, a: amount, r: reference, e: expiresAt })`
`+ "." + base64url(first 16 bytes of HMAC-SHA256(ORDER_SECRET, payload))`. `a` is base units
as a string, `e` unix seconds, 15 minutes after creation. Under 200 characters — it rides in
the QR's URL.

| Route | Does |
|---|---|
| `POST /api/orders { items[{ sku, qty }] }` | prices from the catalog file (never from the body) → `{ token, checkoutUrl, paymentUrl, amount, reference, expiresAt }` |
| `GET·POST·OPTIONS /api/pay/[token]` | the SDK handler; `resolve` checks the HMAC, the expiry, and `findPayment` (already paid → `ORDER_PAID`) |
| `GET /api/orders/[token]/status` | `{ status: 'pending' \| 'paid' \| 'paid_late' \| 'expired' \| 'invalid', signature? }` from `findPayment` + `verifySplitPayment` |
| pages | `/` catalog · `/cart` · `/checkout/[token]` (QR, pay button, status) · `/orders/[token]` (receipt: legs and explorer link) |

---

## 5. The components — `@bujius/checkout-react`

| Export | Props | Behaviour |
|---|---|---|
| `BujiusCheckoutWalletProvider` | `endpoint`, `children` | connection + wallet-adapter provider (Wallet Standard discovery, no wallet list hard-coded) + its modal |
| `PaymentQR` | `url`, `size = 256` | the QR of a `solana:` URL |
| `PayButton` | `transactionRequestUrl`, `onSigned(signature)`, `onError(code, sentence)`, `label?`, `className?` | not connected → opens the modal · connected → `POST { account }`, deserializes, asks the wallet to sign and send, reports the signature, then stays locked for that URL. Default label "Pay with {wallet name}". `code`: `INVALID_ACCOUNT`, `ORDER_NOT_FOUND`, `ORDER_HELD`, `ORDER_PAID`, `ORDER_EXPIRED`, `RPC_UNAVAILABLE`, `REQUEST_FAILED`, `WALLET_FAILED`; `sentence` is the text to show the payer |
| `usePaymentStatus` | `statusUrl`, `intervalMs = 2000` | polls until `paid`, `paid_late`, `expired` or `invalid` → `{ status, signature, error }` |
| `openCheckout` | `checkoutUrl` | redirect — the hosted checkout's entry point |

**Payer-facing copy** may say "USDC", the wallet's name and the token amount — the payer
already holds crypto. Amounts show two decimals ("12.50 USDC"). **One exception: a leg on a
receipt shows its exact amount ("0.0875 USDC"),** because rounded legs would not prove the split.

---

## 6. The hosted service — `apps/hosted`

### Tables (Neon Postgres, Drizzle)

| Table | Columns |
|---|---|
| `merchants` | `id` (`mch_…`) · `name` · `split_config` (base58) · `api_key_hash` (SHA-256, unique) · `webhook_secret` · `created_at` |
| `charges` | `id` (`ch_…`) · `merchant_id` → merchants · `reference` (unique) · `amount` (numeric, base units) · `order_id` · `webhook_url?` · `success_url?` · `status` (`pending` \| `paid` \| `paid_late` \| `expired`) · `payer?` · `signature?` (unique) · `expires_at` · `paid_at?` · `created_at` · unique (`merchant_id`, `order_id`) |
| `webhook_deliveries` | `id` · `charge_id` → charges · `event_type` · `status_code?` · `error?` · `attempt` · `sent_at` |

### HTTP — `Authorization: Bearer sk_test_…` where marked

| Route | Auth | Does |
|---|---|---|
| `POST /v1/charges` | key | body `{ amount: "12.50", orderId, webhookUrl?, successUrl?, expiresInSeconds? (60–3600, default 900) }` — **strict: any other field (a wallet, recipients, a config, a mint) → 400**; who gets paid comes from the merchant's `split_config`. `webhookUrl` and `successUrl` are `https:` only. A second call with the same pending `orderId` and amount returns the same charge (`200`); the same `orderId` on a charge that is not pending, or with another amount, is `409 ORDER_ID_IN_USE`. → `201 { id, reference, amount, mint, status, checkoutUrl, paymentUrl, expiresAt }` |
| `GET /v1/charges/:id` | key, own merchant | the charge plus `webhook: { lastStatusCode, lastSentAt }` |
| `GET /v1/charges/:id/status` | public | `{ status, signature, reference, amount, expiresAt, successUrl }`; an unknown charge is `404` with the error envelope; while `pending`, asks the chain first (reconcile on read) |
| `GET·POST·OPTIONS /pay/:reference` | public | the SDK handler; `resolve` reads the charge, then **holds it for the first payer** — a conditional update setting `payer` only when empty or equal → `ORDER_HELD` for anyone else |
| `POST /v1/charges/:id/webhook/resend` | key | sends the charge's event again → `200 { event, attempt, statusCode, error }`; `409 CHARGE_NOT_PAID` until paid, `409 NO_WEBHOOK_URL` without a `webhookUrl` |
| `POST /hooks/helius` | `Authorization` = `HELIUS_WEBHOOK_SECRET` | for each transaction, the pending charges whose `reference` is among its account keys → verify → flip → webhook; answers `200` at once |
| `GET /c/:id` | public | the hosted checkout page (`B7`). After `paid`, it redirects to the charge's `successUrl` with `?chargeId=<id>` appended (kept alongside any query the URL already has); only `https:` URLs are followed |

Errors: `{ "error": { "code", "message" } }`.

**`chargeId` on the `successUrl` is a locator, never proof of payment:** anyone can type a URL with an id.
The store uses it to find its order, then confirms the payment from the signed webhook or
`GET /v1/charges/:id` (with its API key) before it ships anything.

**Formats, in every charge response and in the webhook:** `amount` is base units as a string
(`"12500000"`), `expiresAt` is ISO 8601. Only the `POST /v1/charges` body takes a decimal
(`"12.50"`). Another merchant's charge is a `404`, never a `403`.

**The flip:** `UPDATE charges SET status, signature, paid_at WHERE id = … AND status =
'pending' RETURNING id`. Only the caller that gets the row back sends the webhook — status
poll, Helius and a second lambda can race; one wins. `pending` lasts until `expires_at` + 90 s
(so a payment signed near the end still lands as `paid_late`); then `expired` is computed and
written.

### The webhook to the store

`POST webhookUrl`, JSON
`{ id: "evt_…", type: "charge.paid" | "charge.paid_late", createdAt, data: { chargeId, orderId, reference, amount, mint, signature, paidAt } }`,
header `BujiusCheckout-Signature: t=<unix>,v1=<hex HMAC-SHA256(webhook_secret, "<t>.<raw body>")>`.
One attempt, 5 s timeout, a `webhook_deliveries` row either way; the receiver refuses a `t`
more than 300 s away. Redelivery is the resend route, with the same event `id`. The sender goes
only to public HTTPS hosts (no localhost, private or link-local address, including a name that
resolves to one) and never follows a redirect.

---

## 7. Environment variables

| App | Variable | What |
|---|---|---|
| both apps | `RPC_URL` | server-side Helius devnet URL — never `NEXT_PUBLIC_` |
| both apps | `NEXT_PUBLIC_RPC_URL` | `https://api.devnet.solana.com` — the browser only sends |
| both apps | `NEXT_PUBLIC_BASE_URL` | the deployment's HTTPS origin |
| demo store | `ORDER_SECRET` | the order token's HMAC key |
| demo store | `NEXT_PUBLIC_SPLIT_CONFIG` | the test config's address (`A3`) |
| demo store | `PAY_STRATEGY` | `program` or `transfers` (the cut) |
| demo store, hosted mode | `HOSTED_API_URL` · `HOSTED_API_KEY` · `HOSTED_WEBHOOK_SECRET` | `B8` |
| hosted | `DATABASE_URL` · `HELIUS_WEBHOOK_SECRET` · `PAY_STRATEGY` | `A8`–`A10` |
| scripts | `DEPLOYER_KEYPAIR` · `MERCHANT_KEYPAIR` · `PAYER_KEYPAIR` (paths) | `A3`; the files stay outside the repository |
