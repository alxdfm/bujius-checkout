# @bujius/checkout-sdk

The TypeScript side of [Bujius Checkout](https://github.com/alxdfm/bujius-checkout): split one
payment between a merchant and its partners in a single Solana transaction, host the Solana Pay
transaction request, and verify what was paid. **Devnet only.** Node 22+ and the browser.

```bash
npm install @bujius/checkout-sdk @solana/web3.js
```

The program is [`LNv2EvYZFN1fBJeQPDGffRxVYPMCGpa99yCcWDSDdjN`](https://explorer.solana.com/address/LNv2EvYZFN1fBJeQPDGffRxVYPMCGpa99yCcWDSDdjN?cluster=devnet)
(`PROGRAM_ID`). Its verifiable build hash is in the [root README](../../README.md).

## The split rule

For every payment, `share[i] = floor(amount × bps[i] / 10 000)`, computed with 128-bit
intermediates; the merchant gets the remainder, so `merchant + Σ shares = amount`, always. The
program, `computeSplit` and the verifier all follow this one rule. Amounts are `bigint` in base
units (USDC: 6 decimals); a float never holds money.

```ts
computeSplit(1_000_001n, [333, 333]); // { shares: [33300n, 33300n], merchant: 933401n }
toBaseUnits('12.50', 6);              // 12500000n
fromBaseUnits(12_500_000n, 6);        // '12.5'
```

## Exports

### Amounts and helpers

| Export | Takes | Returns |
|---|---|---|
| `toBaseUnits(decimal, decimals)` | a decimal string | `bigint`; throws `INVALID_AMOUNT` on a sign, an exponent, or too many decimals |
| `fromBaseUnits(amount, decimals)` | a `bigint` | the decimal string, never in scientific notation |
| `newReference()` | — | a fresh `PublicKey`: the Solana Pay reference of one payment |
| `paymentUrl(handlerHttpsUrl)` | your handler's HTTPS URL | the `solana:` transaction request URL a QR carries |
| `computeSplit(amount, bps)` | `bigint`, `number[]` | `{ shares: bigint[], merchant: bigint }` |

### The split config (on-chain)

| Export | Takes | Returns |
|---|---|---|
| `findSplitConfig(authority, id)` | the merchant's key, the config id | the config's address |
| `fetchSplitConfig(connection, address)` | | `{ address, authority, id, mint, recipients[{ wallet, bps }] }`; throws `CONFIG_NOT_FOUND` |
| `buildCreateSplit(connection, authority, id, mint, recipients)` | up to four `{ wallet, bps }` | an unsigned `Transaction`: creates every destination token account (idempotently), then `create_split`. The authority signs and sends it. |

A config is immutable: there is no update and no close.

### Building a payment

`buildSplitPayment(connection, config, payer, amount, reference, strategy)` returns an unsigned
legacy `Transaction`, fee payer = the payer, blockhash at `confirmed`. Missing token accounts are
created by the transaction, idempotently, paid by the payer.

| `strategy` | What the transaction contains |
|---|---|
| `'program'` | the idempotent account creates plus one `pay` instruction: the split is enforced on-chain |
| `'transfers'` | the same creates plus one `transfer_checked` per leg, with the reference as a readonly key on the first transfer |

The payer cannot be the merchant or one of the recipients (`INVALID_ACCOUNT`).

### Hosting the transaction request

`createTransactionRequestHandler({ connection, label, iconUrl, strategy, resolve })` returns
`(request: Request) => Promise<Response>`. Export it as `GET`, `POST` and `OPTIONS`.

`resolve(key, account)` gets the last path segment of the URL and the payer's account, and returns
`{ config, amount, reference, message }` or `{ error: ErrorCode }`. It is where your store looks up
the order: **who gets paid is the config, never the request.** The handler answers the wallet's
`GET` with `{ label, icon }`, its `POST { account }` with `{ transaction, message }`, and every
response, `OPTIONS` included, carries the CORS headers a wallet needs.

| Code returned by `resolve` | Status | Sentence the wallet shows |
|---|---|---|
| `INVALID_ACCOUNT` | 400 | We could not read your account. Try again. |
| `ORDER_NOT_FOUND` | 404 | This order does not exist. |
| `ORDER_HELD` | 409 | Someone else is already paying this order. |
| `ORDER_PAID` | 409 | This order is already paid. |
| `ORDER_EXPIRED` | 410 | This order expired. Go back to the store and start again. |
| `RPC_UNAVAILABLE` | 503 | The network is busy. Try again in a moment. |
| anything else | 500 | This order cannot be paid. Go back to the store. |

### Finding and verifying a payment

| Export | Takes | Returns |
|---|---|---|
| `findPayment(connection, reference)` | | the first successful signature that mentions the reference, or `null` |
| `verifySplitPayment(connection, signature, config, amount, reference, expiresAt?)` | `expiresAt` is a `Date` | `{ status: 'paid' \| 'paid_late' \| 'invalid', reason?, legs[{ wallet, amount }] }` |

`findPayment` finding a signature does not mean the amount is right. **Only `verifySplitPayment`
decides.** It works for both strategies because it reads balances, not instructions: the
transaction succeeded, the reference is among its account keys, the mint is the config's, and the
merchant's and each recipient's balance rose by exactly `computeSplit(amount)`. A block time after
`expiresAt` is `paid_late`. Any other mismatch is `invalid`, with the reason.

The program guarantees the split; the verifier guarantees the amount, because anyone holding the
reference can send a different amount.

### Errors

Errors are typed codes, never sentences: `BujiusCheckoutError` carries `.code`, and
`isBujiusCheckoutError(value)` narrows it. The codes (`ErrorCode`) are `ORDER_NOT_FOUND`,
`ORDER_EXPIRED`, `ORDER_PAID`, `ORDER_HELD`, `INVALID_ACCOUNT`, `INVALID_AMOUNT`,
`CONFIG_NOT_FOUND` and `RPC_UNAVAILABLE`.

## RPC notes

Reads use commitment `confirmed`. The SDK derives token accounts and reads them with
`getMultipleAccountsInfo`; it never calls `getTokenAccountsByOwner`. Keep your RPC URL (it may
carry a key) on the server: the browser only needs to send transactions.

## License

MIT
