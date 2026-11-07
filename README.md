# Bujius Checkout

Splitting a payment between a merchant and its partners usually means trusting a backend to do the
math later. Bujius Checkout does it in the payment itself: **one Solana transaction pays the
merchant and every partner**, with the percentages read from an on-chain config the partners can
audit — no account per sale, and no backend of ours in the way.

Built during the MLH Solana Hackathon (November 2026) as the open split primitive for Bujius Pay.
**Devnet only.**

| | |
|---|---|
| Program (devnet) | [`LNv2EvYZFN1fBJeQPDGffRxVYPMCGpa99yCcWDSDdjN`](https://explorer.solana.com/address/LNv2EvYZFN1fBJeQPDGffRxVYPMCGpa99yCcWDSDdjN?cluster=devnet) |
| Verifiable build (SHA-256) | `7311c0155b90e5bb857bc1c2477ec46444ec6a6a555b9935f1dd7336ee76b984` — `anchor build --verifiable`; equals the bytecode deployed on devnet |
| `@bujius/checkout-sdk` | [on npm](https://www.npmjs.com/package/@bujius/checkout-sdk) · [README](packages/sdk/README.md) |
| `@bujius/checkout-react` | [on npm](https://www.npmjs.com/package/@bujius/checkout-react) · [README](packages/react/README.md) |
| Demo store (no database) | https://bujius-checkout.vercel.app |
| Hosted checkout and API | https://bujius-checkout-hosted.vercel.app |

## How it works

![The payment flow: store, wallet, program and verifier](docs/architecture.svg)

- **The program** (`bujius_checkout`) keeps one `SplitConfig` per merchant: the token and up to four
  partners with basis points. It is immutable, so a partner trusts terms that cannot change under
  them. `pay` moves one transfer per recipient and the remainder to the merchant, atomically.
  It creates no account.
- **The SDK** builds the payment, hosts the Solana Pay transaction request a store serves on its
  own backend, and **verifies** a payment by reading balances: the program guarantees the split,
  the verifier guarantees the amount.
- **The React package** gives the QR, a connected-wallet pay button and a status hook.
- **The hosted service** is optional, a convenience on top: a charges API, a checkout page and a
  signed webhook, for a store that does not want to run any of this itself.

Who gets paid never comes from a request. It lives in the merchant's on-chain config.

## Integrate in ten lines

On your server (any framework that speaks `Request`/`Response`; this is a Next.js route):

```ts
const connection = new Connection(process.env.RPC_URL!, 'confirmed');
const handler = createTransactionRequestHandler({
  connection, label: 'My store', iconUrl: 'https://my.store/icon.svg', strategy: 'program',
  resolve: async (orderId) => {
    const order = await db.find(orderId); // your order: you decide amount and reference
    if (!order) return { error: ErrorCode.ORDER_NOT_FOUND };
    const config = await fetchSplitConfig(connection, new PublicKey(process.env.SPLIT_CONFIG!));
    return { config, amount: BigInt(order.amount), reference: new PublicKey(order.reference), message: `Order ${order.id}` };
  },
});
export { handler as GET, handler as POST, handler as OPTIONS };
```

Then show the payer a QR, or a button:

```tsx
<BujiusCheckoutWalletProvider endpoint="https://api.devnet.solana.com">
  <PaymentQR url={paymentUrl(`${origin}/api/pay/${order.id}`)} />
  <PayButton transactionRequestUrl={`${origin}/api/pay/${order.id}`} onSigned={() => {}} onError={(code, sentence) => alert(sentence)} />
</BujiusCheckoutWalletProvider>
```

Mark an order paid only after the verifier says so — never from the button's callback:

```ts
const signature = await findPayment(connection, reference);
const result = signature && (await verifySplitPayment(connection, signature, config, amount, reference, expiresAt));
// result.status: 'paid' | 'paid_late' | 'invalid'
```

Each export is described in the [SDK](packages/sdk/README.md) and [React](packages/react/README.md) READMEs.

### Or use the hosted service

```bash
curl -X POST https://bujius-checkout-hosted.vercel.app/v1/charges \
  -H "Authorization: Bearer sk_test_…" -H "Content-Type: application/json" \
  -d '{"amount":"12.50","orderId":"order-1","successUrl":"https://my.store/thanks"}'
```

The answer carries a `checkoutUrl` to send the payer to. The body is strict: a wallet, recipients or
a mint in it is a `400`. The service tells your store with a webhook signed with HMAC-SHA256
(`BujiusCheckout-Signature`), one attempt per event, plus a resend route. Routes and formats are in
[`docs/CONTRACTS.md`](docs/CONTRACTS.md) §6.

## What it does not do

- Devnet only. Classic SPL Token only (no Token-2022). The hosted service prices in USDC (6 decimals).
- A split config cannot be changed or closed.
- `PayButton` reads legacy transactions only, and tells `ORDER_PAID` from `ORDER_HELD` by the
  endpoint's English sentence, so it is tested against this project's handler, not against every
  Solana Pay endpoint.
- `@bujius/checkout-react` imports the wallet modal's CSS, so it needs a bundler that handles CSS
  (tested with Next.js 15).

## Develop

```bash
pnpm install
pnpm verify          # typecheck, lint, build, unit tests
pnpm test:program    # anchor test (Anchor 0.31.1, Solana 4.2.2)
```

Verify the deployed program yourself: `anchor build --verifiable` (Docker), then compare
`sha256sum target/verifiable/bujius_checkout.so` with
`solana program dump LNv2EvYZFN1fBJeQPDGffRxVYPMCGpa99yCcWDSDdjN out.so -u devnet && sha256sum out.so`.

Interfaces: [`docs/CONTRACTS.md`](docs/CONTRACTS.md) · overview:
[`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md).

## License

MIT
