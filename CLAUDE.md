# CLAUDE.md — Bujius Checkout

> Entry point of every session. Read it in full before doing anything.

---

## ⚡ Session start protocol

**Always, in this order:**

1. Read this CLAUDE.md in full
2. Read `docs/sessions/STATE.md` — what is true now and what is next
3. Read `docs/conventions/UBIQUITOUS_LANGUAGE.md` — **the glossary is law in this project**
4. Read `docs/CONTRACTS.md` before touching the program, the SDK's exports or a route
5. Before starting a card, open it in `docs/planning/tasks/` (`track-a.md` or `track-b.md`)
6. Check the branch: `git branch --show-current` — the two tracks share `main`
7. Confirm: "Context loaded. Card: [X]. Branch: [Y]. Ready."

**Never assume context you have not read. Never invent a name without checking the
ubiquitous language.**

---

## 🎯 About this project

```
Name:        Bujius Checkout (repository bujius-checkout · program bujius_checkout ·
             npm @bujius/checkout-sdk and @bujius/checkout-react)
Domain:      web3 / payments — an open Solana program and SDK that split one payment between
             a merchant and its partners, atomically, at the moment of the sale
Status:      active — built during the MLH Solana Hackathon
Started:     2026-11-06 14:00 (Brasília)
Hackathon:   MLH Solana Hackathon, online — hacking Fri 2026-11-06 14:00 → final submission
             Sun 2026-11-08 13:45 (Brasília; ET + 2 h)
Network:     devnet only
Team:        Track A — Alexandre (program, SDK on-chain side, verifier, hosted backend)
             Track B — the partner (SDK client side, components, demo store, hosted page, video)
```

**The thesis in one sentence:** one transaction pays the merchant and every partner, with the
percentages read from an on-chain config the partner can audit — no account per sale, no
backend of ours in the way.

**What it is for:** Bujius Checkout is the open split primitive and SDK **for Bujius Pay**
(`docs/decisions/2026-11-06_name-and-bujius-pay-relationship.md`). Bujius Pay will depend on
it after the event; this repository never depends on Bujius Pay and never contains its code,
keys or infrastructure (`docs/planning/PLAN.md` §1).

**Who guarantees what:** the program guarantees the split; the verifier guarantees the amount.

---

## ⏳ Hackathon context (drives prioritisation)

- **Only code written during the event counts.** Commit often, never squash — the history is
  the evidence (`PLAN.md` §6).
- **The gate is Sat 14:00:** a phone purchase through the program on devnet, verified by the
  SDK. Nothing after the gate starts before the gate passes or is called.
- **The cut is Sat 02:00:** if `pnpm smoke --strategy program` does not print `PAID`, the default
  strategy becomes `transfers` and program work stops.
- **Code freeze Sun 11:00.** After Sun 08:00, fixes only.
- **The video is the submission.** A feature that risks the happy path is a loss.
- **Do not expand scope.** The "Stretch" row of `PLAN.md` §3 happens only if everything above
  it is done. Ask first.

---

## 📐 Working rules

### Cards
- Every piece of work is a card in `docs/planning/tasks/`. The card is the requirement — its
  **Already decided** bullets are constraints, **Touch only these files** is the complete list.
  A card that seems to need another file: stop and say so. → `docs/planning/tasks/README.md`
- **File ownership:** a file owned by one track is never edited by the other (`PLAN.md` §4).
  `[A+B]` files are append-only.

### Branches and commits
- Trunk `main`. One short branch per card: `a/<card>` or `b/<card>` (`a/a1-create-split`).
- Merge as soon as the card is green — `pnpm verify` in CI is the only gate. Rebase on `main`
  before the PR.
- Conventional Commits, English, first line only, no `Co-Authored-By`. Stage files explicitly,
  never `git add .`.
- `pnpm-lock.yaml` conflict: take `main`'s, run `pnpm install`, commit.
- A contract change (`docs/CONTRACTS.md`) is agreed by message first and lands in the same
  commit as the code that needs it.
- **Before every push:** `pnpm verify` and the local `pre-push` hook (`PLAN.md` §1).

### Files and language
- No file above **400 lines**. One file = one responsibility. Files and folders `kebab-case`;
  types `PascalCase`. Rust files `snake_case`.
- **Everything in this repository is English** — code, comments, docs, commits, branches.
- Unit tests in `__tests__/unit.test.ts`; integration tests in `__tests__/integration.test.ts`.

### Definition of done

| Command | What it proves |
|---|---|
| `pnpm verify` | typecheck of every package and app · lint of the apps · SDK unit tests · build of the packages |
| `pnpm test:program` | `anchor test` — the program's tests on a local validator |
| `pnpm smoke --strategy program` / `--strategy transfers` | on devnet: the SDK builds, signs, sends, and the verifier prints `PAID <signature>` |

`verify` does not run Anchor — CI has no Solana toolchain. A card that touches `programs/`
is done only when `pnpm test:program` passes too.

### Technical decisions
- Every non-trivial decision goes to `docs/decisions/YYYY-MM-DD_title.md` (template
  `_TEMPLATE.md`). Read the existing ones before proposing something that contradicts them.
- Never install a dependency outside `PLAN.md` §5 without recording why.

### Closing a session
- `docs/sessions/STATE.md` — correct the facts that changed. It describes the present and
  does not grow.
- `docs/sessions/YYYY-MM-DD.md` — what happened, what was learned. May grow freely.

---

## 🚨 Domain guardrails — breaking these breaks the product

### Money
- **A float never holds money.** Amounts are `bigint` in base units end to end (USDC: 6
  decimals); decimal strings exist only at the edges — an API body, a screen.
- **The split math is one rule in three places** — program, `computeSplit`, verifier:
  `share[i] = floor(amount × bps[i] / 10 000)` with 128-bit intermediates; the merchant gets
  the remainder; `merchant + Σ share = amount`, always (contracts §2).
- **Never mark a payment paid from `findPayment` alone** or from the pay button's success
  callback. Only `verifySplitPayment` decides.

### On-chain
- **No account per sale.** One `SplitConfig` per merchant per `id`; `pay` creates nothing.
  Missing token accounts are created by the transaction builder, idempotently, paid by the
  payer.
- **A `SplitConfig` is immutable in the MVP** — no update, no close. A partner trusts terms
  that cannot change under them.
- **Seeds and account layouts never change after the devnet deploy.** If one has to, stop and
  say so.
- **Classic SPL Token only.** Token-2022 is out of scope.
- **Never trust the order of `remaining_accounts`** — check each one against its recipient.

### Who gets paid
- **Recipients never come from a request.** They live in the merchant's on-chain
  `SplitConfig`. `POST /v1/charges` is strict: a wallet, recipients, a config or a mint in the
  body is a `400`.

### Secrets
- **No keypair ever enters git** — not the program's, the deployer's, the merchant's or the
  payer's. Scripts read them from paths in env vars (`DEPLOYER_KEYPAIR`, …), and a keypair path
  never goes into a committed file.
- **`RPC_URL` (Helius) never reaches the browser.** The browser only sends, through
  `NEXT_PUBLIC_RPC_URL`.
- **An API key is never logged**, never in a `NEXT_PUBLIC_` variable, stored only as SHA-256.

### RPC
- **Never call `getTokenAccountsByOwner`.** Derive the ATA and read that one account; batch with
  `getMultipleAccountsInfo`.

### The transaction request
- **Every response carries the CORS headers**, `OPTIONS` included — without the preflight the
  wallet fails silently and the QR does nothing (contracts §4).

### UX
- **Payer-facing copy may name the token and the wallet** ("Pay with Phantom", "12.50 USDC"),
  amounts with two decimals. **An error is never vague** — the handler's sentences in
  contracts §4.

---

## 🚫 General guardrails

- **Never** copy a file, function or snippet from the Bujius Pay repository (`PLAN.md` §1)
- **Never** create files outside the structure without proposing it and getting a yes
- **Never** use synonyms for domain terms — check `UBIQUITOUS_LANGUAGE.md`
- **Never** refactor beyond the card
- **Never** run destructive commands without explicit confirmation
- **Never** deploy to mainnet

---

## 🗂️ Project map

```
CLAUDE.md                      ← you are here
Anchor.toml · Cargo.toml       ← the program workspace; [toolchain] pins Anchor 0.31.1 + Solana 4.2.2
package.json · pnpm-workspace.yaml · tsconfig.base.json   ← the pnpm workspace (packages/*, apps/*)
.github/workflows/verify.yml   ← CI: pnpm verify on push to main and on PRs
programs/bujius-checkout/src/  ← the program: SplitConfig, create_split, pay           [A]
tests/bujius-checkout.ts       ← anchor test (ts-mocha), local validator               [A]
packages/sdk/                  ← @bujius/checkout-sdk — core, strategies, server handler, program, verify  [A+B]
packages/react/                ← @bujius/checkout-react — provider, QR, pay button, status hook (B3)  [B]
apps/demo-store/               ← Next.js demo store, no database (B3)                  [B]
apps/hosted/                   ← hosted checkout: API, page, webhook (after the gate)  [A+B]
scripts/                       ← devnet: create-test-split · smoke-pay · measure-pay-tx · create-merchant  [A]
docs/
  CONTRACTS.md                 ← the frozen interfaces — program, split math, SDK, HTTP, components, hosted, env
  architecture/OVERVIEW.md     ← the two layers, the payment flow, who guarantees what
  architecture/STACK.md        ← toolchain, local setup, what not to use
  conventions/UBIQUITOUS_LANGUAGE.md  ← glossary (source of truth)
  conventions/CODE_STYLE.md    ← TypeScript and Rust patterns
  planning/PLAN.md             ← the build plan: scope, layout, stack, schedule, risks, pitch lines
  planning/tasks/              ← the cards: README (the contract), track-a, track-b
  decisions/                   ← decision records — READ before contradicting one
  sessions/STATE.md            ← what is true now. Read this one
```

## 📎 Quick references

| I need | Read |
|---|---|
| What to do now | `docs/sessions/STATE.md` → the card in `docs/planning/tasks/` |
| An interface (account, export, route, env var) | `docs/CONTRACTS.md` |
| Versions and allowed dependencies | `docs/planning/PLAN.md` §5 · `docs/architecture/STACK.md` |
| Who owns a file | `docs/planning/PLAN.md` §4 |
| The schedule, the cut, the gate | `docs/planning/PLAN.md` §8 |
| Why the project is shaped like this | `docs/decisions/` |
| A line for the pitch | `docs/planning/PLAN.md` §12 — only once its card is done |
