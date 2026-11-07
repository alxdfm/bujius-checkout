# STATE — what is true now

> Describes the present and does not grow: a line that became past tense is deleted, not
> rewritten as history. History goes in `YYYY-MM-DD.md` beside this file.

**Updated:** 2026-11-06 (Fri, during the event)

## Where we are

- **`B4` is done:** `BujiusCheckoutWalletProvider`, `PayButton`, `usePaymentStatus`, `openCheckout`.
  Contracts §5 now has `onError(code, sentence)`, `className?` and the button's lock after a send.
  Not yet run in a real browser or with a real wallet: that is `B5`.
- **`B3`'s code is on `main`, the card is not done:** `apps/demo-store` and `PaymentQR` run locally
  against devnet. Still to do: the Vercel deploy and the first phone payment. The QR has not been
  seen in a browser yet.
- **`B2` is done** and on `main`: `createTransactionRequestHandler`, with `resolve(key, account)`.
  Not yet called by a real wallet: that is `B3`.
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
| A | `A6` the gate run (needs `B6`) | Sat 11:30–14:00 |
| B | `B3`: Vercel deploy from `main` (root `apps/demo-store`) and the first phone payment; **read *Noticed* first** | Fri 19:30–21:30 |
| B | `B5`: cart, checkout, order page and every state | Fri 23:00–02:00 |

- Devnet test split config: `3gwKrgMCA8qNp7RXrpfPs63HB5wVFACYYQC39Vx3xr3N` (merchant `HFkj…`,
  partner 1 000 bps, platform 250 bps, devnet USDC). Keypairs live in
  `~/.config/bujius-checkout/keys/` (outside the repository). Hand the address to B for
  `NEXT_PUBLIC_SPLIT_CONFIG`.

## Open

- MLH rules questions (Discord + e-mail, 2026-11-05) — unanswered.
- `PLAN.md` §9 item 7 — Vercel, Neon, Helius devnet key, npm scope `@bujius`.

## Noticed (outside any card)

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
- **The SDK's ESM bundle does not load in Node.** `strategies/program.ts` has
  `import { BN, … } from '@coral-xyz/anchor'`, and Node refuses it: "Named export 'BN' not found".
  The CJS bundle loads, and `pnpm verify` does not catch it. The demo store's Next build bundles
  it and is not affected; a direct Node import is. Owner: A.
- **`apps/demo-store` has no `lint` script.** `eslint` is not in `PLAN.md` §5, so the lint step of
  `pnpm verify` does nothing for it. The tracks have to decide whether to add it.
- **For `A9`:** `resolve` now gets `(key, account)`, so the hold can compare the payer, and it runs
  before `buildSplitPayment`. A payer the builder then refuses (no token account, a leg's wallet,
  off-curve) has already taken the hold, and the real payer would get `ORDER_HELD`. Check before
  the hold, or release it on failure. Owner: A.
- **`usePaymentStatus` stops at `expired`, so it never reaches `paid_late`.** A payment landing just
  after the expiry would stay unseen. No card or contract covers it. Plan for `B5`'s status route:
  keep answering `pending` for a few seconds past the expiry before `expired`.
- **`@bujius/checkout-react` is not ready for `B9` yet.** `wallet-provider.tsx` imports the modal's
  CSS, which Next handles and a plain Node `require` does not. `PayButton` deserializes legacy
  transactions only, and `codeOf` tells `ORDER_PAID` from `ORDER_HELD` by the English sentence, so
  "any Solana Pay endpoint" is not fully true: do not say it in the pitch.
- **Failures that only reach the console:** `WalletProvider` has no `onError`, so a failed connection
  shows the payer nothing. `usePaymentStatus` keeps polling after a `4xx`.
- **`packages/sdk/__tests__/unit.test.ts` is at 518 lines, over the 400 limit.** Splitting it is on
  no card; the tracks have to agree who does it. `B2`'s tests went to
  `__tests__/handler.unit.test.ts` so as not to grow it.
