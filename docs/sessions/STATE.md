# STATE — what is true now

> Describes the present and does not grow: a line that became past tense is deleted, not
> rewritten as history. History goes in `YYYY-MM-DD.md` beside this file.

**Updated:** 2026-11-06 (Fri, during the event)

## Where we are

- **`B1` is done** and on `main`: `toBaseUnits`, `fromBaseUnits`, `newReference`, `paymentUrl`,
  `computeSplit`, `buildSplitPayment` with `strategy: 'transfers'`.
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
| A | `A4` SDK program strategy, `findPayment`, smoke, tx size; **read *Noticed* first** | Fri 23:00–02:00 |
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
- **`A4` — open question. Agent: ask Alexandre before starting this card.** `buildSplitPayment`
  lives in `packages/sdk/src/strategies/transfers.ts` (owned by B) and throws
  `program strategy not implemented` for `'program'`, but that file is not on `A4`'s **Touch
  only these files** list, so `A4` cannot connect `strategies/program.ts` as written. Proposal
  from B: add the file to `A4`'s list, for this one change only — replace that `throw` with the
  call to the program builder, and update the test
  `skips a zero leg and throws for the program strategy until A4`. Amount validation already
  runs before the strategy check (`INVALID_AMOUNT` outside 1..=u64::MAX), and so does the check
  that the payer is not a leg's wallet (`INVALID_ACCOUNT`), so `program.ts` repeats neither. Delete
  this note once `A4` settles it.
- **`buildCreateSplit` rejects off-curve recipients; `buildSplitPayment` accepts them.**
  `program/create-split.ts` derives ATAs with the default `allowOwnerOffCurve = false`, so a PDA
  or multisig recipient throws there. Owner: A.
- **A demo payer must be its own wallet.** `buildSplitPayment` refuses a payer who is the merchant
  or a recipient: the verifier could never mark that payment paid. On camera and in `B3`, pay
  from a wallet with USDC that is in neither role.
- **For `B2`:** `computeSplit` throws `CONFIG_NOT_FOUND` for bps no config can hold, and the builder
  throws `INVALID_AMOUNT` for an amount out of range. Neither code is in the contracts §4 table, so
  the handler has no status or sentence for them yet; agree one before `B2` ends. A payer with no
  token account, or who is a leg's wallet, gets `INVALID_ACCOUNT`.
- **Deferred from the `B1` review:** `toBaseUnits` has no upper bound · a missing mint reports
  `INVALID_ACCOUNT`, whose sentence blames the payer · `fromBaseUnits` trims to `12.5`, so screens
  pad to two decimals themselves · `paymentUrl` accepts `http://` and throws an untyped `TypeError`
  on a bad URL · the builder's `program` and unknown-strategy branches throw plain `Error`s.
- **`pnpm verify` on Windows skips the build and the lint and still exits 0.** The single quotes
  in `--filter './packages/*'` and `--filter './apps/*'` (root `package.json`) match no project
  there ("No projects matched"). Until fixed, run
  `pnpm --filter "./packages/*" --if-present run build` by hand on Windows.
- **`packages/sdk/__tests__/unit.test.ts` is at 398 lines of the 400 limit.** `B2` and `A4` both
  append to it, and splitting it is on no card. The tracks have to agree who splits it, and how,
  before `B2`.
