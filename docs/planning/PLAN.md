# Bujius Checkout — the build plan

> How the two of us build the project during the MLH Solana Hackathon, hour by hour. The
> interfaces are in [`../CONTRACTS.md`](../CONTRACTS.md). The cards are in
> [`tasks/track-a.md`](tasks/track-a.md) (Alexandre) and [`tasks/track-b.md`](tasks/track-b.md)
> (the partner). Why the plan is what it is: [`../decisions/`](../decisions/).
>
> **This plan holds no code.** MLH asks for code written during the event; plans and
> designs made before are allowed. Contracts are tables and prose, never a snippet to paste.

| | |
|---|---|
| **Event** | MLH Solana Hackathon, online — hacking Fri 2026-11-06 14:00 → final submission Sun 2026-11-08 13:45 (Brasília; ET + 2 h) |
| **Team** | two developers working in parallel — **Track A** (Alexandre): program, SDK on-chain side, verifier, service backend · **Track B** (the partner): SDK client side, payment components, demo store, hosted checkout UI, submission |
| **Network** | devnet only |
| **Gate** | Sat 14:00 — a phone purchase through the program on devnet, verified by the SDK |
| **Cut** | Sat 02:00 — the program is not paying on devnet → the SDK's default strategy becomes plain SPL transfers |

---


## 1. What never enters this repository

Bujius Checkout is the open split program and SDK **for Bujius Pay** (decision
`2026-11-06_name-and-bujius-pay-relationship.md`). The name says so. What stays out is the
other product's **code, keys and infrastructure** — MLH asks for code written during the
event, and keys are never shared across projects.

| Never in this repository | Why |
|---|---|
| Any file, function or snippet from the Bujius Pay repository, retyped or pasted — "just this one function" included | MLH: code is written during the event |
| Bujius Pay's program id, its test mint, its keypairs (fee payer, platform treasury, deployer), its treasury | keys and on-chain identities are never shared across projects |
| Bujius Pay's brand files — the shield, the app palette, the landing copy | this repository has its own neutral look |
| Bujius Pay's infrastructure — its domains, Resend domain, Supabase projects, Helius key | separate infrastructure, separate secrets |

Circle's devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) is a public mint and
may be used. A test mint, if one is needed, is minted fresh at the event.

**The check runs before every push** — a **local** `pre-push` hook in `.git/hooks/`, never
committed, because its pattern names the other product's ids. It refuses a push when the tree
contains Bujius Pay's program id, its test mint, or the private repository's code name. Alexandre
hands the hook file to the partner directly — it is never pasted into a tracked file.

---

## 2. Name

**Bujius Checkout** — decided by the user on 2026-11-06. Program `bujius_checkout`
(directory `programs/bujius-checkout/`), packages `@bujius/checkout-sdk` and
`@bujius/checkout-react`, types `BujiusCheckout…`, webhook header `BujiusCheckout-Signature`.
After the repository exists, the name stays.
---

## 3. What gets built

Two layers (`docs/decisions/2026-11-04_open-split-program-and-sdk.md`, decision 5):

| Layer | Piece | Owner | Level |
|---|---|---|---|
| Open | `bujius_checkout` program — `SplitConfig` per merchant, `create_split`, `pay` | A | MVP |
| Open | SDK on-chain side — program strategy, config fetch, `create_split` builder, verifier | A | MVP |
| Open | SDK client side — amounts, reference, payment URL, split math, transfers strategy, transaction request handler | B | MVP |
| Open | `@bujius/checkout-react` — wallet provider, QR, pay button, payment status hook | B | MVP |
| Open | demo store — Next.js, uses only the SDK and its own backend, **no database** | B | MVP |
| Open | verifiable build, MIT licence, npm `0.1.0` | A | after the gate |
| Service | `apps/hosted` backend — Postgres, API keys, charges API, transaction request, status with reconcile, signed webhook once, resend, Helius trigger | A | after the gate |
| Service | `apps/hosted` checkout page; demo store's "hosted mode" with a webhook receiver | B | after the gate |
| Stretch | per-sale affiliate, editing or closing a config, fee sponsorship, WooCommerce, merchant panel, a second currency | — | only if everything above is done |

**The demo store has no database.** An order is an HMAC-signed token (items, amount,
reference, expiry); "paid" is what the verifier finds on-chain. The chain is the source of
truth — and that is a line for the pitch (§12).

---

## 4. Repository layout

```
bujius-checkout/
  Anchor.toml · Cargo.toml · package.json · pnpm-workspace.yaml · tsconfig.base.json
  LICENSE (MIT) · README.md · .github/workflows/verify.yml
  programs/bujius-checkout/src/   lib · state · errors · events · instructions/{create_split, pay}   [A]
  tests/bujius-checkout.ts        anchor test, local validator                                       [A]
  packages/sdk/src/
    core/                      amounts · reference · url · split-math                             [B]
    strategies/transfers.ts                                                                       [B]
    server/handler.ts          the transaction request handler                                    [B]
    program/                   idl.json · pda · config · create-split                             [A]
    strategies/program.ts                                                                         [A]
    verify/                    find-payment · verify-payment                                      [A]
    index.ts                   public exports — append-only, each owner appends their own lines  [A+B]
    __tests__/unit.test.ts     vitest — each owner appends their own describe blocks              [A+B]
  packages/react/src/          wallet-provider · payment-qr · pay-button · use-payment-status · open-checkout  [B]
  apps/demo-store/             Next.js 15                                                         [B]
  apps/hosted/
    package.json · next.config · app/layout                 scaffolded in B7; package.json append-only  [B, A+B]
    app/api/ · app/pay/ · app/hooks/ · lib/db/ · lib/webhook/ · drizzle.config               [A]
    app/c/[id]/                the hosted checkout page                                           [B]
  scripts/                     devnet: create-test-split · smoke-pay · measure-pay-tx · create-merchant  [A]
  docs/CONTRACTS.md            the frozen interfaces                                             [A+B]
```

The bracket is the owner. A file owned by one track is never edited by the other; a change
it needs goes through a message and the owner's commit. `[A+B]` files are append-only.

---

## 5. Stack — the versions this team already runs

| Piece | Version | Note |
|---|---|---|
| Node / pnpm | 22 / 11.18 | `.nvmrc`, `packageManager` |
| Anchor CLI · `anchor-lang` · `anchor-spl` | 0.31.1 | pinned in `Anchor.toml` `[toolchain]` together with `solana_version` |
| Solana CLI | 4.2.2 | without `solana_version` in `[toolchain]`, `avm` falls back to agave 2.1.0 |
| `@coral-xyz/anchor` | **0.31.1, no caret** | the TS client must match `anchor-lang`; one minor ahead reads the IDL differently, silently |
| `@solana/web3.js` · `@solana/spl-token` | 1.98.x · 0.4.x | what `@solana/pay` builds on |
| `@solana/pay` | current 0.2.x | `encodeURL`, `createQR`, `findReference` |
| `@solana/wallet-adapter-react` · `-react-ui` · `-wallets` | current | fastest path to Phantom, Solflare and Backpack on desktop |
| Next.js · React · Tailwind | 15.5.x · 19.1 · 4 | |
| Drizzle ORM · drizzle-kit · `postgres` | 0.45 · 0.31 · 3.4 | `apps/hosted` only |
| Postgres | **Neon**, a new free database through the Vercel Marketplace | no Supabase project slot needed |
| RPC | server: a new Helius devnet key · browser: `https://api.devnet.solana.com` | the Helius key never reaches the browser |
| Tests | `anchor test` (ts-mocha) for the program · vitest for the SDK | |
| SDK build | tsup — ESM + CJS + `.d.ts` | |
| Scripts | `tsx` | runs `scripts/*.ts` (`pnpm smoke`) |

The program builds in the team's existing Anchor environment (§9, item 4), with the
`[toolchain]` pin in the new `Anchor.toml`. `anchor build --verifiable` (Docker) comes after
the gate, in `A7`.

---

## 6. Branches, commits, merges

- **Trunk:** `main`. One short branch per card — `a/<card>` or `b/<card>` (`a/a1-create-split`).
- **Merge as soon as the card is green**, no waiting for review; `pnpm verify` green in CI is
  the only gate. Rebase on `main` before opening the PR.
- **Commit often, never squash.** The history is the evidence that the code was written at
  the event. Conventional Commits, English, first line only.
- **The repository is public from the first push.** The check in §1 runs before it.
- `pnpm-lock.yaml` conflicts: take `main`'s, run `pnpm install`, commit.
- A contract change (`docs/CONTRACTS.md`) is agreed by message first and lands in the same
  commit as the code that needs it.
- Vercel deploys from `main`. The commit author has to be allowed to deploy on the Vercel
  team — settle it at `A0`.

---

## 7. Definition of done

| Command | What it proves |
|---|---|
| `pnpm verify` | typecheck of every package and app · lint of both apps · SDK unit tests · build of `sdk` and `react` |
| `anchor test` | the program's tests on a local validator |
| `pnpm smoke --strategy program` / `--strategy transfers` | on devnet: builds a payment for the test config through the SDK handler, signs with a funded test payer, sends, and the verifier prints `PAID <signature>` |

---

## 8. The schedule

Brasília time. Each row is a card in the track files. `▲` is a sync point (10 minutes, both).

| When | Track A — Alexandre | Track B — the partner |
|---|---|---|
| Fri 14:00 | `A0` repository, workspace, `verify`, CI, local hook (45 min) | create Vercel project and Neon database; read `A0`'s branch |
| ▲ 14:45 | **contracts copied into `docs/CONTRACTS.md` — frozen** | same |
| Fri 15:00–18:00 | `A1` program: `SplitConfig`, `create_split`, tests | `B1` SDK core: amounts, reference, URL, split math, transfers strategy |
| Fri 18:00–21:30 | `A2` program: `pay`, tests | `B2` transaction request handler · `B3` demo store, first deploy |
| ▲ 21:30 | **first phone payment on devnet, transfers strategy** | |
| Fri 21:30–23:00 | `A3` deploy to devnet, IDL into the SDK, config fetch, `create_split` builder, test config | `B4` react package: provider, pay button, status hook |
| Fri 23:00–02:00 | `A4` SDK program strategy, `findPayment`, `smoke`, tx size | `B5` demo store: checkout and order pages, screens |
| ▲ **Sat 02:00** | **the cut** — `pnpm smoke --strategy program` prints `PAID`, or the default strategy becomes `transfers` | |
| Sat 02:00–09:00 | sleep | sleep |
| Sat 09:00–11:30 | `A5` verifier: amount, legs, `paid_late` | `B6` demo store on the program strategy and on `A5` |
| Sat 11:30–14:00 | `A6` gate run with B, fixes | `B6` phone and desktop runs, **backup footage** |
| ▲ **Sat 14:00** | **the gate** | |
| Sat 14:00–16:00 | `A7` verifiable build, redeploy, licence, npm `0.1.0` | `B7` hosted checkout page against mocked API |
| Sat 16:00–19:30 | `A8` hosted backend: schema, API keys, charges API | `B7` continues |
| Sat 19:30–23:00 | `A9` transaction request, status with reconcile, webhook once, resend | `B8` demo store hosted mode, webhook receiver |
| ▲ 23:00 | **hosted checkout end to end, status polling** | |
| Sat 23:00–02:00 | `A10` Helius trigger | `B9` READMEs, architecture picture, Devpost draft |
| Sun 02:00–08:00 | sleep | sleep |
| Sun 08:00–11:00 | `A11` fixes only, **code freeze 11:00** | `B10` record the video on the deployed build (08:00–10:30), edit (10:30–11:45) |
| ▲ **Sun 12:00** | **initial submission on Devpost** — whatever works | |
| Sun 12:00–13:45 | final README pass, Devpost links | final video upload, Devpost text — **final submission by 13:45** |

**Fallbacks that keep the schedule:**
- Sat 02:00 cut: A stops program work and starts `A5`; the program strategy stays in the SDK
  behind the flag, and the pitch keeps the open SDK and the split.
- `A8`–`A10` late: the service layer is not in the video. The video carries the open layer.
- `A10` (Helius) late: status polling stays the only confirmation — the hosted checkout
  already works on it.

---

## 9. Before `A0` — accounts and keys (no code)

| # | Item | Owner |
|---|---|---|
| 1 | Rules questions sent to MLH (Discord + e-mail, 2026-11-05) — answers pending | A |
| 2 | Both registered on the MLH event; address form filled | both |
| 3 | ✓ Name — Bujius Checkout (§2) | both |
| 4 | ✓ Anchor environment — Anchor 0.31.1, Solana CLI 4.2.2. Machine state, not a file | A |
| 5 | Fresh keypairs: deployer, merchant, partner, test payer — none from Bujius Pay. Deployer funded with **≥ 6 SOL** (two deploys and an upgrade buffer), the rest with 1 SOL each, from `faucet.solana.com`. Before `A3` | A |
| 6 | ✓ Devnet USDC on the phone wallet (Solflare — it shows devnet tokens Phantom hides). Still to do: the test payer's USDC and a desktop extension with devnet on | B |
| 7 | Empty accounts: GitHub repository (public), Vercel (who deploys — §6), Neon, Helius devnet key, npm scope `@bujius` | B (GitHub, npm: A) |
| 8 | Read the Solana Pay spec — transfer request and transaction request — and the wallet-adapter Next.js guide | both |
| 9 | The video script and the Devpost skeleton | B |

---
## 10. Risks

| Risk | Mitigation |
|---|---|
| The program does not pay on devnet by Sat 02:00 | the transfers strategy has worked since Fri 21:30; switch the default, keep going |
| Devnet faucet dry or rate-limited | item 5 on Thursday; a second deployer funded the same day |
| wallet-adapter fights React 19 | fallback `@wallet-standard/app` for discovery plus a hand-written connect, inside `B4` only |
| Public devnet RPC rate limits in the browser | the browser only sends; every read runs on the server through Helius. The public devnet RPC throttles `getTokenAccountsByOwner` first — the SDK never calls it, it derives the ATA and reads that one account |
| The QR is too dense with the signed token in the path | the token stays under 200 characters (contracts §4); a denser QR means trimming the token, not the URL scheme |
| Helius devnet webhooks behave differently than expected | `A10` is the last service card; polling already confirms |
| A judge reads it as a rebranded existing product | every line written at the event (commit often, never squash — §6), the rules questions to MLH, a pitch about the open primitive |
| Two people in the same file | the ownership map in §4; append-only shared files |

---


## 11. How Bujius Pay uses it, after the event

This repository is a dependency of Bujius Pay, never the other way round:

- `@bujius/checkout-react`'s pay button speaks the plain Solana Pay transaction request, so
  Bujius Pay's payment page can use it against its own transaction request endpoint unchanged.
- The webhook design (signed, sent once on the `pending → paid` flip, resend) and the API-key
  auth are the shape of the Checkout inside Bujius Pay. The `bujius_checkout` program stays a
  public good here; Bujius Pay keeps its own program.
- Payer-facing copy may name the token and the wallet; the merchant's screens never do.

---
## 12. Lines for the pitch

Collected while planning, so they are not lost. Each one is true of the build only once its
card is done — the video and the Devpost text use a line only after checking that.

| Line | True once | Where it came from |
|---|---|---|
| "The chain is the source of truth. The demo store has no database: an order is a signed token, and *paid* is what the verifier finds on-chain." | `B5` + `A5` | §3 — the demo store design |
| "An atomic split at the moment of sale, with rules the partner audits on-chain — ready for checkout and point of sale." | `A2` | decision 5; **never** "nobody did this" (decision 6) |
| "The program guarantees the split; the verifier guarantees the amount." | `A5` | decision 6, adjustment 2 |
| "Who gets paid never comes from the request — it lives in the merchant's on-chain config." | `A2` · `A8` | the strict `POST /v1/charges` body |
| "A partner can trust terms that cannot change under them: a split config is immutable." | `A1` | contracts §1 |
| "One account per merchant, none per sale — a sale costs only its transaction fee." | `A2` | contracts §1 |
| "Open program, open SDK: any store runs it on its own backend, with no dependency on ours." | `A7` · `B9` | decision 5 |
| "The pay button speaks plain Solana Pay — it works against any transaction request endpoint." | `B4` | decision 6, adjustment 3 |
| "Verifiable: the program's hash on devnet matches the source in the repository." | `A7` | the public-good argument |
| "A webhook the store can trust — signed, and sent exactly once." | `A9` | the conditional flip |

