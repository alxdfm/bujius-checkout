# STATE — what is true now

> Describes the present and does not grow: a line that became past tense is deleted, not
> rewritten as history. History goes in `YYYY-MM-DD.md` beside this file.

**Updated:** 2026-11-07 (Sat, during the event)

## Where we are

- **`A10`'s route is in and verified from a local server:** a payment made with no page open, then a
  simulated Helius POST with the secret, turned the charge `paid` and left one `webhook_deliveries` row;
  the reply took 0.02 s; no or a wrong `Authorization` is `401`. **Still open:** register the webhook in
  Helius once the hosted app is deployed — type **`rawDevnet`** (the reference is a readonly account, which
  an enhanced payload may omit), account address = the program id, URL `<deployment>/hooks/helius`,
  `authHeader` = `HELIUS_WEBHOOK_SECRET`. The same value goes in the deployment's env.
- **`A9`'s code is in, verified on devnet from a local server:** a real 0.10 USDC payment through
  `/pay/:reference` turned the charge `paid`; 8 simultaneous status polls left one `paid` row and
  one `webhook_deliveries` row; a second payer got `ORDER_HELD`; a paid charge answers `ORDER_PAID`.
  **Still open for `A9`'s Done when:** a phone payment through B's page on a deployed hosted app,
  and a 2xx from the demo store's receiver (the deployed store answered `404` — it needs the
  `B8` deploy with `HOSTED_WEBHOOK_SECRET`). Known limit: `findPayment` returns the first successful
  signature, so a wrong-amount transaction sent to a reference first keeps the charge `pending`.
- **`A8` is done:** `POST` and `GET /v1/charges` on the Neon database (migration `0000` applied),
  strict zod bodies, API keys stored as SHA-256, `scripts/create-merchant.ts` prints the key and
  webhook secret once. `curl` creates a charge and returns `checkoutUrl` and `paymentUrl`; the same
  `orderId` returns the same charge. Contracts §6 now has the agreed status shape, formats and 90 s.
- **`A7` is done:** the verifiable build's SHA-256 equals the bytecode already on devnet
  (`7311c015…b76b984`), so no upgrade was needed; hash in the README. `@bujius/checkout-sdk@0.1.0`
  is public on npm; use `0.1.2` (`0.1.1` is deprecated: it breaks bundlers).
- **`A6` is done — the gate passed (Sat 2026-11-07), tag `gate`.** Phone (Solflare, 0.20 USDC,
  `5gWMyGgY…AruUZ`) and desktop (Backpack, 0.25 USDC, `56MMtDUe…`) purchases on the deployed store
  through the program: each split exact on-chain, order page `Paid`. A headless run also checked
  CORS, the transaction request, the status route and `ORDER_PAID` on a second pay. Still B's:
  the two backup takes.
- **`B6`'s code is in:** `PAY_STRATEGY=program` on the deployed store, the status route on
  `verifySplitPayment`, and `paid_late` and `invalid` with their own screens. Still to do: record
  the two takes.
- **`B3` and `B5` are done** on https://bujius-checkout.vercel.app: a phone payment of 0.10 USDC and
  a desktop payment of 0.20 USDC through the program, both verified, with the checkout moving to
  `Paid` by itself.
- **`B4` is done:** `BujiusCheckoutWalletProvider`, `PayButton`, `usePaymentStatus`, `openCheckout`.
  Contracts §5 now has `onError(code, sentence)`, `className?` and the button's lock after a send.
- **`B2` is done** and on `main`: `createTransactionRequestHandler`, with `resolve(key, account)`.
- **`B1` is done** and on `main`: `toBaseUnits`, `fromBaseUnits`, `newReference`, `paymentUrl`,
  `computeSplit`, `buildSplitPayment` with `strategy: 'transfers'`.
- **`A5` is done:** `verifySplitPayment(connection, signature, config, amount, reference, expiresAt?)`
  judges by balances (`expiresAt` is a `Date`); fixtures in `packages/sdk/__tests__/fixtures/`;
  `pnpm smoke` prints `PAID` from the verifier. B may now render `Paid` from it.
- **`A4` is done and the cut passed:** `pnpm smoke --strategy program` and `--strategy transfers`
  both print `PAID` on devnet (0.10 USDC: merchant 87 500, partner 10 000, platform 2 500). The
  worst-case `pay` transaction is 790 bytes (limit 1232). **Tell B: `PAY_STRATEGY=program`.**
- **`A1`, `A2` and `A3` are done** and merged on `main` (`SplitConfig`, `create_split`, `pay`;
  `anchor test` 19 passing, program deployed on devnet, `pnpm verify` green). `tests/bujius-checkout.ts` is at 359 lines —
  split it before it passes 400.
- **`A0` is done.** The workspace is on `main` at https://github.com/alxdfm/bujius-checkout and
  CI (`pnpm verify`) is green. `pnpm verify` exits 0; `anchor build` passes on the template
  program.
- Program id (from `anchor init`, in `Anchor.toml` and `declare_id!`):
  `LNv2EvYZFN1fBJeQPDGffRxVYPMCGpa99yCcWDSDdjN`. Its keypair is backed up outside the
  repository.- Track B has been told the workspace is on `main` and is in the GitHub organisation.

## Next

| Track | Card | Slot (Brasília) |
|---|---|---|
| A | Register the Helius webhook and run `A9`/`A10`'s deployed checks (both need the hosted deployment) · then `A11` | Sun 08:00 |
| B | `B7` open: the scaffold and `/c/[id]` against a mock are on `main`, so `A8` can start. It stays on the mock until `A9` lands, then runs the test below | Sat 14:00–19:30 |
| B | `B6`: record the phone and desktop takes on the deployed store | left for last, by B's choice; needed before `B10` (Sun 08:00) |

- The Neon database exists, created through Vercel. It still has to be connected to the
  `apps/hosted` project, which does not exist yet, and `DATABASE_URL` goes to A outside the repository.
- **To close `B7` once `A9` is on `main`:** make `app/c/[id]/page.tsx` read
  `GET /v1/charges/:id/status`, point the panel's polling at it, delete `mock-charges.ts` and
  `mock-status/`, and deploy the second Vercel project. Then test on the deployment:
  1. A charge created with `curl` opens on `/c/:id` and shows the QR (`B7`'s **Done when**).
  2. Pay it by phone from a wallet that is neither the merchant nor a recipient: the page turns
     `Paid` by itself, with no reload, and the explorer link opens the transaction.
  3. A charge with a `successUrl`: after `paid`, the page redirects there.
  4. A second payer on a held charge sees "Someone else is already paying this order."
  5. An unknown id shows "Charge not found"; `/c/ch_mock_paid` too, so the mock is gone.
  6. A charge with `expiresInSeconds: 60`, unpaid: it shows "Charge expired" by itself about 90 s
     after the expiry.
  7. A preview deployment without `NEXT_PUBLIC_BASE_URL`: a pending charge shows "This page could
     not load". Never run on a deployment: in dev Next answers its own 500, and the mock could not
     reach this path in production.
- **Agreed between A and B for `A8`/`A9`; `CONTRACTS.md` §6 changes with A's code that needs it:**
  `GET /v1/charges/:id/status` answers `{ status, signature, reference, amount, expiresAt, successUrl }`,
  and an unknown charge gets a `404` with §6's error envelope. `amount` is base units as a string
  and `expiresAt` ISO 8601, in every charge response and in the webhook; `POST /v1/charges` still
  takes `"12.50"`. `pending` lasts until `expires_at` + 90 s, when `expired` is computed and written
  (replacing §6's 60 s). `successUrl` and `webhookUrl` are `https:` only, and the webhook sender
  blocks internal hosts. `/c/[id]`'s mock uses this shape.
- **For `A8`:** `apps/hosted/next.config.ts` rewrites `/v1/:path*` to `/api/v1/:path*`, because
  contracts §6 serves `/v1/...` and `A8`'s handlers live in `app/api/v1/`. Nothing to do on A's side.
- **Owners agreed for `B7`'s scaffold:** in `apps/hosted`, `.env.example` is `[A+B]`, append-only;
  `tsconfig.typecheck.json`, `postcss.config.mjs`, `.gitignore`, `app/globals.css`, `app/page.tsx`
  and `public/icon.svg` are B's.
- Devnet test split config: `3gwKrgMCA8qNp7RXrpfPs63HB5wVFACYYQC39Vx3xr3N` (merchant `HFkj…`,
  partner 1 000 bps, platform 250 bps, devnet USDC). Keypairs live in
  `~/.config/bujius-checkout/keys/` (outside the repository). Hand the address to B for
  `NEXT_PUBLIC_SPLIT_CONFIG`.

## Open

- MLH rules questions (Discord + e-mail, 2026-11-05) — unanswered.
- `PLAN.md` §9 item 7 — Vercel, Helius devnet key.

## Noticed (outside any card)

- **The Vercel project deploys a private copy, not this repository:** `Cristierre/bujius-checkout`.
  A push to `main` does not reach the store until it is also pushed there. Connect the project to
  `alxdfm/bujius-checkout` before the gate. Owner: B, with A for the GitHub app.
- **A payer with no USDC account hears "We could not read your account."** `buildSplitPayment`
  answers `INVALID_ACCOUNT`, so a wallet with SOL only gets a sentence that does not say why, against
  the "never vague" rule. Changing it is a contracts §4 change, to agree with A.
- `anchor` needs `~/.local/share/solana/install/active_release/bin` on `PATH`.
- **`buildCreateSplit` rejects off-curve recipients; `buildSplitPayment` accepts them.**
  `program/create-split.ts` uses the default `allowOwnerOffCurve = false`. Owner: A.
- **A demo payer must be its own wallet.** `buildSplitPayment` refuses a payer who is the merchant
  or a recipient. On camera and in `B3`, pay from a wallet with USDC that is in neither role.
- **Invalid bps still reuse `CONFIG_NOT_FOUND`,** against `errors.ts` ("existing codes never change
  meaning"). The handler answers it, `INVALID_AMOUNT` and any other error with contracts §4's 500
  row. Other `B1` review items are in `2026-11-06.md`.
- **`pnpm verify` on Windows skips the build and the lint and still exits 0.** The single quotes
  in `--filter './packages/*'` and `--filter './apps/*'` (root `package.json`) match no project
  there ("No projects matched"). Until fixed, run
  `pnpm --filter "./packages/*" --if-present run build` by hand on Windows.
- **`/c/[id]` copies from the demo store:** `format-usdc`, `send-lock`, `use-send-lock`, and in
  `checkout-panel.tsx` `useCountdown`, `clock` and nearly all of the panel's JSX, because neither
  app may import from the other and `apps/hosted/lib/` is A's. A shared home would be
  `packages/react`, outside `B7`. Owner: B.
- **The demo store's send lock has two bugs the hosted copy fixed.** A stored time in the future
  locks the checkout until the order expires, and when a write to storage fails, an older stored
  time hides the newer send, so the page offers to pay again while it can still land. It does not
  affect the demo. Owner: B.
- **`apps/demo-store` and `apps/hosted` have no `lint` script.** `eslint` is not in `PLAN.md` §5, so
  the lint step of `pnpm verify` does nothing for them. The tracks have to decide whether to add it.
- **For `A9`:** `resolve` now gets `(key, account)`, so the hold can compare the payer, and it runs
  before `buildSplitPayment`. A payer the builder then refuses (no token account, a leg's wallet,
  off-curve) has already taken the hold, and the real payer would get `ORDER_HELD`. Check before
  the hold, or release it on failure. Owner: A.
- **The status route answers `pending` for 90 seconds past the expiry,** then `expired`, because
  `usePaymentStatus` stops at `expired` and a late payment would stay unseen. No contract line says
  so: `EXPIRY_GRACE_SECONDS` in `apps/demo-store/lib/order-status.ts`.
- **One wrong transaction can block an order for good.** `findPayment` returns the earliest
  successful signature carrying the reference, and the reference is public in the token. Anyone
  sending a tiny transaction with it first makes the order `invalid`, and `resolve` then answers
  `ORDER_PAID`. No money is lost, and it does not affect the demo. Owner: A.
- **`verifySplitPayment` says `invalid` with "transaction not found" when the RPC lists a signature
  it does not serve yet.** That is not a verdict: `readOrderStatus` keeps it `pending`, matching
  that exact text. If the reason changes in the SDK, change it there too. Owner: A.
- **`clearCart` ignores which order was paid.** Reopening an old order's checkout while the panel
  sees it paid can erase a newer cart, and paying by phone with the desktop tab closed keeps the
  paid items. It does not affect the demo. Owner: B.
- **The send lock only covers the button.** A payer who scans the QR twice, or signs a wallet popup
  left open after a reload, can still pay twice before the first one confirms.
- **OneDrive can break `next build` on this machine** (`EINVAL ... readlink` on a file in `.next`).
  Delete `apps/demo-store/.next` and build again.
- **`@bujius/checkout-react` is not ready for `B9` yet.** `wallet-provider.tsx` imports the modal's
  CSS, which Next handles and a plain Node `require` does not. `PayButton` deserializes legacy
  transactions only, and `codeOf` tells `ORDER_PAID` from `ORDER_HELD` by the English sentence, so
  "any Solana Pay endpoint" is not fully true: do not say it in the pitch.
- **Failures that only reach the console:** `WalletProvider` has no `onError`, so a failed connection
  shows the payer nothing. `usePaymentStatus` keeps polling after a `4xx`.
- **`packages/sdk/__tests__/unit.test.ts` is at 518 lines, over the 400 limit.** Splitting it is on
  no card; the tracks have to agree who does it. `B2`'s tests went to
  `__tests__/handler.unit.test.ts` so as not to grow it.
