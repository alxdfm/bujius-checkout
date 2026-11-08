# STATE — what is true now

> Describes the present and does not grow: a line that became past tense is deleted, not
> rewritten as history. History goes in `YYYY-MM-DD.md` beside this file.

**Updated:** 2026-11-07 (Sat, during the event)

## Where we are

- **`B8` is done** (https://bujius-checkout.vercel.app): "Pay through the hosted checkout" on the cart,
  `POST /api/hosted-charges`, the receiver, and `/orders/hosted?chargeId=…`, which reads
  `GET /v1/charges/:id`. A hosted payment (`ch_295b497f…`) reached `paid` with a `200` delivery.
- **`B7` is done** (https://bujius-checkout-hosted.vercel.app): `/c/[id]` reads the status route and
  the mock is gone. Passed on the deployment: the QR, a phone payment, the redirect to `successUrl`
  with `chargeId`, an open tab turning `Paid` by itself on a charge with no `successUrl`
  (`ch_8de3ee2e…`), "Charge not found" for an unknown id and `/c/ch_mock_paid`, the second payer's
  sentence through the page's button, and an open tab turning "Charge expired" by itself on a 60 s
  charge. Without `NEXT_PUBLIC_BASE_URL`, `/c/:id` shows "This page could not load" and the name of the
  variable reaches only the log (checked on a local production build, not on a Vercel preview).
- **`A9` and `A10` are verified on the deployment** (https://bujius-checkout-hosted.vercel.app, Sat
  2026-11-07): a real 0.10 USDC payment through `/pay/:reference` turned the charge `paid` with one
  `webhook_deliveries` row; with the Helius webhook registered (`rawDevnet`, `ANY`, auth header =
  `HELIUS_WEBHOOK_SECRET`), a payment with no page open and no status poll turned `paid` within 10 s
  and left one row. The demo store's receiver accepted the signed webhook with `200` (a resend of `ch_66abd7e3…`, attempt 2,
  after the first attempt got `500` while the store lacked `HOSTED_WEBHOOK_SECRET`). B reported a phone
  payment through `/c/[id]` passing, which closes their Done when.
- **`A8` is done:** `POST` and `GET /v1/charges` on the Neon database (migration `0000` applied),
  strict zod bodies, API keys stored as SHA-256, `scripts/create-merchant.ts` prints the key and
  webhook secret once. `curl` creates a charge and returns `checkoutUrl` and `paymentUrl`; the same
  `orderId` returns the same charge. Contracts §6 now has the agreed status shape, formats and 90 s.
- **`A7` is done:** the verifiable build's SHA-256 equals the bytecode already on devnet
  (`7311c015…b76b984`), so no upgrade was needed; hash in the README. `@bujius/checkout-sdk@0.1.0`
  is public on npm; use `0.1.4` (`0.1.1` is deprecated: it breaks bundlers).
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
| A | `A11` (fixes, freeze, the submission's links) — after the two open checks above | Sun 08:00 |
| B | `B11`: the marketplace storefront, on `@bujius/checkout-sdk` and `@bujius/checkout-react` from npm. Left: deploy, then a phone purchase, direct and hosted | before the takes |
| B | `B6`: record the phone and desktop takes on the deployed store, after `B11` | left for last, by B's choice; needed before `B10` (Sun 08:00) |

- **`B9` is done and on `main`:** the root README, both package READMEs, `docs/architecture.svg`, and
  `@bujius/checkout-react@0.1.0` on npm (README inside). The Devpost draft is outside the repository
  (`~/.config/bujius-checkout/devpost-draft.md`); it leaves out the §12 lines that are not true of the
  build (any-endpoint, point of sale, "exactly once"). The demo video is linked in the README and in
  the Devpost text. The SDK `0.1.3` is on npm with its README.
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

- **A held charge shows no sentence of ours through the QR.** The handler answers `409` with
  "Someone else is already paying this order.", but a phone wallet showed its own "Dados inválidos do
  provedor de pagamento". The page's button shows the sentence. B's call: nothing to do on our side
  for now. Do not show this case on the phone in the video, or claim it in the pitch.
- **The demo store's direct flow has no hold.** `ORDER_HELD` exists only in `apps/hosted`, so two
  wallets on one `/checkout/...` link can both sign and pay the same order twice.
- **Both Vercel projects deploy from `alxdfm/bujius-checkout`.** A commit outside a project's folder can
  come back "Skipped - Not affected". To force one: Deployments → Create Deployment with `main`.
  "Redeploy" reuses that deployment's commit.
- **The local `pre-push` hook checks nothing where `rg` is not an executable.** The failure reads as
  "no match", so the push goes through with `rg: command not found` on screen. Seen on B's machine;
  the same check run with `git grep` found nothing.
- **`/c/[id]` reads the charge through its own public route,** so a pending charge reconciles for the
  page and again on the panel's first poll. A shared server read would live in `lib/`, which is A's.
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
- **One wrong transaction can still block an order in the demo store, no longer in the hosted app.**
  The SDK has `findPayments` (every successful signature, earliest first) and the hosted `reconcileCharge`
  verifies up to 5 of them, so a wrong amount sent first does not hide the right payment (checked on
  devnet: 0.05 USDC first, then 0.10, the charge turned `paid` with the right signature). The demo store
  still uses `findPayment` in `resolve` and in `readOrderStatus`, so a tiny transaction sent first makes
  its order `invalid` and `resolve` answers `ORDER_PAID`. No money is lost and the demo is not affected.
  Owner: B for the store. The hosted fix is deployed and checked in production (0.05 USDC first, then 0.10: `paid` with the right signature); SDK `0.1.4` is on npm.
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
- **`@bujius/checkout-react`'s limits, in its README.** `wallet-provider.tsx` imports the modal's
  CSS, which Next handles and a plain Node `require` does not. `PayButton` deserializes legacy
  transactions only, and `codeOf` tells `ORDER_PAID` from `ORDER_HELD` by the English sentence, so
  "any Solana Pay endpoint" is not fully true: do not say it in the pitch.
- **The demo store takes the packages from npm; `apps/hosted` still uses the workspace.** A fix in
  `packages/` reaches the store only after a publish and a version bump in its `package.json`.
- **Failures that only reach the console:** `WalletProvider` has no `onError`, so a failed connection
  shows the payer nothing. `usePaymentStatus` keeps polling after a `4xx`.
- **`packages/sdk/__tests__/unit.test.ts` is at 518 lines, over the 400 limit.** Splitting it is on
  no card; the tracks have to agree who does it. `B2`'s tests went to
  `__tests__/handler.unit.test.ts` so as not to grow it.
