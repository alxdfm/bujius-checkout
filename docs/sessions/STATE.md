# STATE — what is true now

> Describes the present and does not grow: a line that became past tense is deleted, not
> rewritten as history. History goes in `YYYY-MM-DD.md` beside this file.

**Updated:** 2026-11-06 (Fri, during the event)

## Where we are

- **`A1` and `A2` are done** and merged on `main` (`SplitConfig`, `create_split`, `pay`;
  `anchor test` 19 passing, `pnpm verify` green). `tests/bujius-checkout.ts` is at 359 lines —
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
| A | `A3` devnet deploy, IDL in the SDK, test config | Fri 21:30–23:00 |
| B | Vercel project, Neon database; then `B1` SDK core and the transfers strategy | now → Fri 15:00–18:00 |

## Open

- MLH rules questions (Discord + e-mail, 2026-11-05) — unanswered.
- `PLAN.md` §9 item 5 — fresh devnet keypairs (deployer ≥ 6 SOL), before `A3`.
- `PLAN.md` §9 item 7 — Vercel, Neon, Helius devnet key, npm scope `@bujius`.

## Noticed (outside any card)

- `anchor` needs `~/.local/share/solana/install/active_release/bin` on `PATH`.
