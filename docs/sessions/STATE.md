# STATE — what is true now

> Describes the present and does not grow: a line that became past tense is deleted, not
> rewritten as history. History goes in `YYYY-MM-DD.md` beside this file.

**Updated:** 2026-11-06 (Fri, during the event)

## Where we are

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
| B | `B2` the transaction request handler; **read *Noticed* first** | Fri 18:00–19:30 |

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
- **For `B2`:** `CONFIG_NOT_FOUND` (invalid bps) and `INVALID_AMOUNT` (amount out of range) reach
  the handler but are not in the contracts §4 table. Invalid bps reusing `CONFIG_NOT_FOUND` goes
  against `errors.ts` ("existing codes never change meaning"): agree a code in the same change.
  Other `B1` review items are in `2026-11-06.md`.
- **`pnpm verify` on Windows skips the build and the lint and still exits 0.** The single quotes
  in `--filter './packages/*'` and `--filter './apps/*'` (root `package.json`) match no project
  there ("No projects matched"). Until fixed, run
  `pnpm --filter "./packages/*" --if-present run build` by hand on Windows.
- **`packages/sdk/__tests__/unit.test.ts` is at 398 lines of the 400 limit.** `B2` and `A4` both
  append to it, and splitting it is on no card. The tracks have to agree who splits it, and how,
  before `B2`.
