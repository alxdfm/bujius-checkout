# @bujius/checkout-react

React components for [Bujius Checkout](https://github.com/alxdfm/bujius-checkout): the QR of a
Solana Pay transaction request, a connected-wallet pay button, and a status hook. **Devnet only.**

```bash
npm install @bujius/checkout-react
```

## Requirements

- React 19 (`react` and `react-dom` are peer dependencies).
- **A bundler that handles CSS.** `BujiusCheckoutWalletProvider` imports the wallet modal's
  stylesheet, so a plain Node `import` or `require` of this package fails. It is tested with
  Next.js 15 (App Router); every export is a client component.
- A transaction request endpoint that answers like the
  [`@bujius/checkout-sdk`](../sdk/README.md) handler, and a status URL (below).

## Components and hooks

| Export | Props | What it does |
|---|---|---|
| `BujiusCheckoutWalletProvider` | `endpoint`, `children` | The connection and the wallet adapter with its modal. Wallets are found by Wallet Standard discovery, none is hard-coded. `endpoint` is the RPC the browser sends through: never one that carries a key. |
| `PaymentQR` | `url`, `size = 256` | Draws the QR of a `solana:` URL (what `paymentUrl` from the SDK returns). Browser only. |
| `PayButton` | `transactionRequestUrl`, `onSigned(signature)`, `onError(code, sentence)`, `label?`, `className?` | Not connected: opens the wallet modal. Connected: `POST { account }` to the endpoint, deserializes the transaction, asks the wallet to sign and send it, calls `onSigned`, then stays locked for that URL. Default label: "Pay with {wallet name}". |
| `usePaymentStatus` | `statusUrl`, `intervalMs = 2000` | Polls the URL until the payment is final. Returns `{ status, signature, error }`. |
| `openCheckout` | `checkoutUrl` | A plain redirect to a hosted checkout page. |

`PayButton`'s `onError` gets a `code` — `INVALID_ACCOUNT`, `ORDER_NOT_FOUND`, `ORDER_HELD`,
`ORDER_PAID`, `ORDER_EXPIRED`, `RPC_UNAVAILABLE`, `REQUEST_FAILED` or `WALLET_FAILED` — and the
`sentence` to show the payer. A Solana Pay endpoint answers a sentence, not a code, so the button
maps the SDK handler's sentences to codes.

## `onSigned` is not "paid"

The wallet sending the transaction does not mean the order is paid. Decide that on your server,
with the SDK's `verifySplitPayment`, and let the page learn it from `usePaymentStatus`.

`statusUrl` must answer `200` with JSON `{ "status": "pending" | "paid" | "paid_late" | "expired" | "invalid", "signature"?: string }`.
The hook stops on anything but `pending`.

## Example

```tsx
'use client';
import { BujiusCheckoutWalletProvider, PayButton, PaymentQR, usePaymentStatus } from '@bujius/checkout-react';

export function Checkout({ paymentUrl, payUrl, statusUrl }: { paymentUrl: string; payUrl: string; statusUrl: string }) {
  const { status } = usePaymentStatus(statusUrl);
  return (
    <BujiusCheckoutWalletProvider endpoint="https://api.devnet.solana.com">
      <PaymentQR url={paymentUrl} />
      <PayButton
        transactionRequestUrl={payUrl}
        onSigned={() => {}}
        onError={(code, sentence) => console.log(code, sentence)}
      />
      <p>{status}</p>
    </BujiusCheckoutWalletProvider>
  );
}
```

## Limits

- `PayButton` deserializes legacy transactions only.
- It tells `ORDER_PAID` from `ORDER_HELD` by the SDK handler's English sentence, so it is tested
  against that handler, not against every Solana Pay endpoint.
- `WalletProvider` has no `onError`: a failed wallet connection shows the payer nothing.
- `usePaymentStatus` keeps polling after a `4xx` from the status URL.

## License

MIT
