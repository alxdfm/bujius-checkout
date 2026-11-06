# STATE — what is true now

> Describes the present and does not grow: a line that became past tense is deleted, not
> rewritten as history. History goes in `YYYY-MM-DD.md` beside this file.

**Updated:** 2026-11-06 (Fri, during the event)

## Where we are

- **`A0` is scaffolded locally, not pushed.** Done: `anchor init` (pnpm), `[toolchain]` pins,
  workspace, `tsconfig.base.json`, root scripts, `packages/sdk` skeleton with
  `BujiusCheckoutError` + every `ErrorCode` and a passing test, CI workflow, MIT licence, README
  paragraph, `docs/CONTRACTS.md`, local `pre-push` hook. `pnpm verify` exits 0; `anchor build`
  passes on the template program.
- **Missing for `A0` to be done:** the public GitHub repository, the remote, the first commits,
  push, CI green on `main`, tell B the workspace is on `main`.
- Program id (from `anchor init`, in `Anchor.toml` and `declare_id!`):
  `LNv2EvYZFN1fBJeQPDGffRxVYPMCGpa99yCcWDSDdjN`. Its keypair is backed up outside the
  repository. `programs/bujius-checkout/src/lib.rs` and `tests/bujius-checkout.ts` are still
  Anchor's template — `A1` replaces them.

## Next

| Track | Card | Slot (Brasília) |
|---|---|---|
| A | `A0` steps 1 and 8 — GitHub, push, CI | now |
| A | `A1` program: `SplitConfig`, `create_split` | Fri 15:00–18:00 |
| B | Vercel project, Neon database; then `B1` SDK core and the transfers strategy | now → Fri 15:00–18:00 |

## Open

- MLH rules questions (Discord + e-mail, 2026-11-05) — unanswered.
- `PLAN.md` §9 item 5 — fresh devnet keypairs (deployer ≥ 6 SOL), before `A3`.
- `PLAN.md` §9 item 7 — Vercel, Neon, Helius devnet key, npm scope `@bujius`.

## Noticed (outside any card)

- Nothing yet.
