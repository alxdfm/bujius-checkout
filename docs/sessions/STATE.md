# STATE — what is true now

> Describes the present and does not grow: a line that became past tense is deleted, not
> rewritten as history. History goes in `YYYY-MM-DD.md` beside this file.

**Updated:** 2026-11-06 (Fri, during the event)

## Where we are

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
| A | `A4` SDK program strategy, `findPayment`, smoke, tx size — needs `B1` on `main`; **read *Noticed* first** | Fri 23:00–02:00 |
| B | Vercel project, Neon database; then `B1` SDK core and the transfers strategy | now → Fri 15:00–18:00 |

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
  runs before the strategy check (`INVALID_AMOUNT` outside 1..=u64::MAX), so `program.ts` does
  not repeat it. Delete this note once `A4` settles it.
- **`pnpm verify` on Windows skips the build and the lint and still exits 0.** The single quotes
  in `--filter './packages/*'` and `--filter './apps/*'` (root `package.json`) match no project
  there ("No projects matched"). Until fixed, run
  `pnpm --filter "./packages/*" --if-present run build` by hand on Windows.
- **`packages/sdk/__tests__/unit.test.ts` is at 395 lines of the 400 limit.** `B2` and `A4` both
  append to it, and splitting it is on no card. The tracks have to agree who splits it, and how,
  before `B2`.
