# Track B cards — the partner

> The SDK's client side, the payment components, the demo store, the hosted checkout page and
> the submission. Plan: [`../PLAN.md`](../PLAN.md) · contracts:
> [`../../CONTRACTS.md`](../../CONTRACTS.md). The seven parts mean what [`README.md`](README.md)
> says; `PLAN.md` §1 (what never enters this repository) and §6 (branches) bind every card.
> `pnpm verify` and the pre-push check run before every push. From 14:00 to 14:45 B creates the
> Vercel project and the Neon database while `A0` lands.

---

### B1 · SDK core and the transfers strategy
**M** · partner · `b/b1-core-transfers` · Fri 15:00–18:00

- **Depends:** `A0`.
- **Why:** a payment that works on devnet without the program — the fallback and the first
  thing the phone can pay.
- **Already decided:** contracts §2 and §3 — `toBaseUnits`/`fromBaseUnits` reject negatives,
  exponents, empty strings and more decimals than the mint has · `newReference` · `paymentUrl`
  through `@solana/pay`'s `encodeURL` · `computeSplit` with the five vectors as tests ·
  `buildSplitPayment` with `strategy: 'transfers'`: derive every destination ATA, one
  `getMultipleAccountsInfo` to find the missing ones, an idempotent create for each missing one,
  one `transfer_checked` per leg (zero legs skipped), the reference as a readonly non-signer key
  on the first transfer, fee payer = payer, blockhash at `confirmed` · until `A3` the config is
  a literal with the contracts §3 shape and the wallets of `PLAN.md` §9 item 5.
- **Touch only these files:** `packages/sdk/src/core/{amounts,reference,url,split-math}.ts`,
  `packages/sdk/src/strategies/transfers.ts`, `packages/sdk/src/index.ts` (append),
  `packages/sdk/__tests__/unit.test.ts` (append), `packages/sdk/package.json` (append).
- **Steps:** 1. Amounts and their tests. 2. Reference and URL. 3. `computeSplit` and the
  vectors. 4. The transfers builder, with `buildSplitPayment`'s full signature (A fills
  `'program'` in `A4`). 5. A unit test that the built transaction has the expected instructions
  and the reference key.
- **Never:** a float anywhere near an amount · `getTokenAccountsByOwner` · change the signature
  after 18:00 without telling A.
- **Done when:** `pnpm verify` green with the vectors and the builder test.

---

### B2 · The transaction request handler
**S** · partner · `b/b2-handler` · Fri 18:00–19:30

- **Depends:** `B1`.
- **Why:** the endpoint a phone wallet calls after scanning the QR.
- **Already decided:** contracts §4 exactly — the three methods, CORS on every response, the
  spec's error envelope, the six codes with their status and sentence, `resolve` gets the last
  path segment · web-standard `Request`/`Response`, so a Next.js route only re-exports it.
- **Touch only these files:** `packages/sdk/src/server/handler.ts`,
  `packages/sdk/src/index.ts` (append), `packages/sdk/__tests__/unit.test.ts` (append).
- **Steps:** 1. The handler. 2. Tests without RPC: `OPTIONS` 204 with the headers, `GET` label
  and icon, a bad `account` 400, each `resolve` error mapped to its status and sentence.
- **Never:** answer without the CORS headers — the wallet then fails silently.
- **Done when:** `pnpm verify` green with the handler tests.

---

### B3 · Demo store v1, the QR, the first phone payment
**M** · partner · `b/b3-store-v1` · Fri 19:30–21:30

- **Depends:** `B2`.
- **Why:** the riskiest integration — HTTPS, the QR, CORS, a real wallet — tested on the first
  night, not on the last.
- **Already decided:** `apps/demo-store` on Next.js 15 and Tailwind, its own neutral look ·
  a catalog file with three products priced in USDC · the order token of contracts §4 ·
  `POST /api/orders` and `/api/pay/[token]` · `packages/react` created here with `PaymentQR`
  only · deployed on Vercel from `main`.
- **Touch only these files:** `apps/demo-store/**`, `packages/react/{package.json,tsconfig.json}`,
  `packages/react/src/{index,payment-qr}.tsx`.
- **Steps:** 1. Scaffold the app. 2. Catalog, order token, the two routes. 3. A bare checkout
  page showing `PaymentQR`. 4. Deploy; set the env of contracts §7. 5. Scan with Solflare on the
  phone; pay.
- **Never:** take a price from the request · a database · the palette or shield of any other
  product.
- **Done when:** a phone payment lands on devnet with the expected legs on the explorer
  (▲ Fri 21:30).

---

### B4 · Payment components
**M** · partner · `b/b4-react` · Fri 21:30–23:00

- **Depends:** `B3`.
- **Why:** a desktop payer, and the components a developer drops into a page.
- **Already decided:** contracts §5 — `BujiusCheckoutWalletProvider` with Wallet Standard discovery,
  `PayButton`, `usePaymentStatus`, `openCheckout` · the button speaks the plain transaction
  request (it works against any Solana Pay endpoint) · default label "Pay with {wallet name}" ·
  if wallet-adapter fights React 19, switch to `@wallet-standard/app` inside this card only.
- **Touch only these files:** `packages/react/src/{index,wallet-provider,pay-button,use-payment-status,open-checkout}.tsx`,
  `packages/react/package.json`.
- **Steps:** 1. The provider. 2. The button. 3. The status hook. 4. `openCheckout`. 5. Build the
  package.
- **Never:** hard-code a wallet list · build the transaction in the browser — the button asks
  the endpoint.
- **Done when:** `pnpm verify` green · the package builds with its `.d.ts`.

---

### B5 · Demo store: checkout, order page, every state
**M** · partner · `b/b5-store-pages` · Fri 23:00–02:00

- **Depends:** `B4`.
- **Why:** the screens the video walks through.
- **Already decided:** contracts §4 pages and the status route · until `A5` lands, the status
  route uses `findPayment` alone and says `paid` — `B6` swaps it for the verifier · states:
  pending (QR, button, countdown), paid (receipt with the legs and an explorer link), expired
  (a button back to the cart), error (the handler's sentence) · payer-facing copy may say "USDC"
  and the wallet's name; amounts with two decimals.
- **Touch only these files:** `apps/demo-store/**`.
- **Steps:** 1. Cart. 2. Checkout page with QR, button and status. 3. Order page. 4. Expired and
  error states. 5. Deploy; run once on the phone and once on the desktop.
- **Never:** mark an order paid from the success callback of the button — only the status route
  decides.
- **Done when:** phone and desktop both reach the order page on the deployed store.

---

### B6 · The store on the program and the verifier — backup footage
**M** · partner · `b/b6-gate` · Sat 09:00–14:00

- **Depends:** `A4` (the cut), `A5`.
- **Why:** the gate.
- **Already decided:** `PAY_STRATEGY` from the cut · the status route uses `verifySplitPayment`;
  `paid_late` and `invalid` get their own state · **record the full purchase twice** (phone and
  desktop) before 14:00, as backup footage for the video.
- **Touch only these files:** `apps/demo-store/**`.
- **Steps:** 1. Switch the strategy and the verifier. 2. Add the two states. 3. Run with A
  (`A6`). 4. Record the two takes.
- **Never:** record over a build that is not deployed.
- **Done when:** the gate passes and the two takes are saved (▲ Sat 14:00).

---

### B7 · `apps/hosted` scaffold and the hosted checkout page
**M** · partner · `b/b7-hosted-page` · Sat 14:00–19:30

- **Depends:** the gate.
- **Why:** the page a store without a backend sends its customer to.
- **Already decided:** B scaffolds `apps/hosted` (Next.js 15, Tailwind, `package.json`,
  `next.config`, `app/layout`) first and pushes it, so `A8` can start · `/c/[id]` reads
  `GET /v1/charges/:id/status` — mocked in the page until `A9` lands · the same components as
  the store, the transaction request URL is `/pay/:reference` · after `paid`, redirect to
  `successUrl` when there is one.
- **Touch only these files:** `apps/hosted/{package.json,next.config.ts,tsconfig.json}`,
  `apps/hosted/{tsconfig.typecheck.json,postcss.config.mjs,.gitignore,.env.example}`,
  `apps/hosted/app/{layout,page}.tsx`, `apps/hosted/app/globals.css`,
  `apps/hosted/public/icon.svg`, `apps/hosted/app/c/[id]/**`, `pnpm-lock.yaml`.
- **Steps:** 1. Scaffold and push. 2. The page against the mock. 3. Swap the mock for the real
  route when `A9` lands. 4. Deploy the second Vercel project.
- **Never:** edit `app/api/`, `app/pay/`, `app/hooks/` or `lib/` — they are A's.
- **Done when:** a charge created with `curl` (`A8`) opens on `/c/:id` and shows the QR.

---

### B8 · Demo store hosted mode and the webhook receiver
**S** · partner · `b/b8-store-hosted` · Sat 19:30–23:00

- **Depends:** `A8`, `B7`.
- **Why:** the store that hosts nothing — and the webhook arriving, on camera.
- **Already decided:** a "Pay through the hosted checkout" option on the cart · the store calls
  `POST /v1/charges` server-side with `HOSTED_API_KEY` and redirects with `openCheckout` ·
  `POST /api/webhooks/bujius-checkout` checks `BujiusCheckout-Signature` (HMAC, 300 s window) against
  `HOSTED_WEBHOOK_SECRET`, logs the event and answers 200 — the store keeps no state; the order
  page in hosted mode reads `GET /v1/charges/:id`, which shows the delivery.
- **Touch only these files:** `apps/demo-store/**`.
- **Steps:** 1. The hosted option. 2. The receiver and its signature check. 3. The hosted order
  page. 4. One phone payment through the hosted checkout (▲ Sat 23:00).
- **Never:** put the API key in a `NEXT_PUBLIC_` variable.
- **Done when:** one hosted payment → the order page shows `paid` and a 2xx delivery.

---

### B9 · READMEs, the architecture picture, Devpost draft, npm react
**M** · partner · `b/b9-docs` · Sat 23:00–02:00

- **Depends:** `B8`.
- **Why:** the judges read the README before they run anything.
- **Already decided:** root README — the problem in two lines, the two layers, the program id
  and hash (from `A7`), install, a ten-line integration, the demo links · `packages/sdk` and
  `packages/react` READMEs with each export · one architecture picture (SVG) · Devpost text built
  from `PLAN.md` §12's lines that are true of the build · publish `@bujius/checkout-react` `0.1.0`.
- **Touch only these files:** `README.md` (sections other than A's program id and hash),
  `packages/{sdk,react}/README.md`, `docs/architecture.svg`, `packages/react/package.json`.
- **Steps:** 1. Root README. 2. Package READMEs. 3. The picture. 4. Devpost draft (outside the
  repository). 5. `npm publish --access public` for the react package.
- **Never:** a claim the deployed build does not do.
- **Done when:** `npm view @bujius/checkout-react` shows `0.1.0` and the README's every link opens.

---

### B10 · The video and the submission
**M** · partner · no branch · Sun 08:00–13:45

- **Depends:** `B9`.
- **Already decided:** the narration uses `PLAN.md` §12's lines, each checked against the
  deployed build · about 3 minutes, on the deployed build: problem (20 s) · phone purchase
  (60 s) · the transaction on the explorer — the program, the legs, the config the partner
  audits (30 s) · the integration lines and the hosted mode with the webhook (30 s) · next steps
  (20 s) · record 08:00–10:30, edit 10:30–11:45 · **initial submission 12:00** with what works ·
  **final by 13:45**.
- **Steps:** 1. Record. 2. Edit; use the Saturday takes where a live take fails. 3. Upload.
  4. Submit at 12:00 with A. 5. Final pass by 13:45.
- **Never:** show a feature that did not work on the deployed build.
- **Done when:** the Devpost final submission is in with the video, the repository and both
  deployments.
