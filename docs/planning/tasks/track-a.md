# Track A cards — Alexandre

> Program, the SDK's on-chain side, the verifier, the hosted backend. Plan:
> [`../PLAN.md`](../PLAN.md) · contracts: [`../../CONTRACTS.md`](../../CONTRACTS.md). The seven
> parts mean what [`README.md`](README.md) says; the rules that bind every card here are
> `PLAN.md` §1 (what never enters this repository) and §6 (branches). `pnpm verify` and the
> pre-push check run before every push.

---

### A0 · Repository, workspace, verify, CI, the local hook
**S** · Alexandre · `main` (the first commits) · Fri 14:00–14:45

- **Depends:** `PLAN.md` §9, items 3–5.
- **Why:** both tracks need the workspace and the frozen contracts before product code.
- **Already decided:** start from `anchor init bujius-checkout`, then switch to pnpm (drop the
  yarn lockfile, add `pnpm-workspace.yaml` with `packages/*` and `apps/*`) · `Anchor.toml`
  `[toolchain]` pins `anchor_version = 0.31.1` and `solana_version = 4.2.2`, `[scripts] test`
  runs ts-mocha through `pnpm exec` · root scripts `verify` (typecheck all, lint apps, vitest,
  build packages), `smoke`, `test:program` · `packages/sdk` skeleton: tsup, vitest,
  `src/index.ts`, `src/errors.ts` with `BujiusCheckoutError` and every `ErrorCode` of contracts §3 ·
  CI runs `pnpm verify` on push and PR, without Anchor · MIT licence · README: one
  paragraph · the program keypair (`target/deploy/bujius_checkout-keypair.json`) is backed up
  outside the repository right after `anchor init`.
- **Touch only these files:** root files, `.github/workflows/verify.yml`, `packages/sdk/`
  (skeleton), `docs/CONTRACTS.md`, `.git/hooks/pre-push` (local, untracked).
- **Steps:**
  1. Create the public GitHub repository, empty.
  2. `anchor init bujius-checkout`; switch to pnpm; add the `[toolchain]` pins.
  3. Add the workspace, `tsconfig.base.json` (strict), the root scripts.
  4. Create the `packages/sdk` skeleton with the errors file and one passing vitest test.
  5. Add CI and the licence; write the README paragraph.
  6. Copy the contracts file into `docs/CONTRACTS.md`, its header rewritten for this repository.
  7. Install the `pre-push` hook from `PLAN.md` §1; run the check by hand.
  8. Push; tell B the workspace is on `main`.
- **Never:** copy `Dockerfile.anchor`, a script or a config file from Bujius Pay · commit
  a keypair · add a dependency not in `PLAN.md` §5.
- **Done when:** `pnpm verify` exits 0 · the §1 check prints nothing · CI is green on `main`.

---

### A1 · Program: `SplitConfig` and `create_split`
**M** · Alexandre · `a/a1-create-split` · Fri 15:00–18:00

- **Depends:** `A0`.
- **Why:** the config is what makes the split auditable on-chain.
- **Already decided:** contracts §1 exactly — fields, 215 bytes, seeds, four checks, their
  errors, `SplitCreated` · classic Token mints only, no allowlist · no update, no close ·
  `anchor keys sync` once, so `declare_id!` and `Anchor.toml` agree.
- **Touch only these files:** `programs/bujius-checkout/src/{lib,state,errors,events}.rs`,
  `programs/bujius-checkout/src/instructions/{mod,create_split}.rs`,
  `programs/bujius-checkout/Cargo.toml`, `Anchor.toml`, `tests/bujius-checkout.ts`.
- **Steps:**
  1. State, errors and events as contracts §1.
  2. `create_split` with its accounts and checks.
  3. Tests: a fresh mint on the local validator · the happy path reads back every field · one
     test per check, asserting its error · the PDA matches the seeds.
- **Never:** an account per sale · a mutable config · Token-2022.
- **Done when:** `anchor test` passes, one test per check plus the happy path.

---

### A2 · Program: `pay`
**M** · Alexandre · `a/a2-pay` · Fri 18:00–21:30

- **Depends:** `A1`.
- **Why:** the split that nobody between the payer and the recipients can change.
- **Already decided:** contracts §1 `pay` and §2 — accounts, the order of the remaining
  accounts, 128-bit intermediates with checked arithmetic, remainder to the merchant, zero legs
  skipped, `transfer_checked`, `SplitPaid`.
- **Touch only these files:** `programs/bujius-checkout/src/instructions/{mod,pay}.rs`,
  `programs/bujius-checkout/src/{lib,errors,events}.rs`, `tests/bujius-checkout.ts`.
- **Steps:**
  1. Accounts and checks.
  2. The math and the transfers.
  3. The event.
  4. Tests: the first four vectors of contracts §2, asserted on balances · each check's error ·
     recipients in the wrong order · one recipient missing · the invariant on every vector.
- **Never:** create a token account inside `pay` · floating point · trust the order of the
  remaining accounts without checking each one.
- **Done when:** `anchor test` passes, vectors included.

---

### A3 · Devnet deploy, the IDL in the SDK, the test config
**M** · Alexandre · `a/a3-devnet` · Fri 21:30–23:00

- **Depends:** `A2`.
- **Why:** B moves from a hand-written config to a real one; the program exists where the
  phone can reach it.
- **Already decided:** deploy with the deployer of `PLAN.md` §9 item 5 (`DEPLOYER_KEYPAIR`, outside the
  repository) · the IDL copied into `packages/sdk/src/program/idl.json` · `findSplitConfig`,
  `fetchSplitConfig`, `buildCreateSplit` as contracts §3 · the test config: the §9
  merchant, the devnet USDC mint, two recipients — a partner at 1 000 bps and a platform at
  250 bps.
- **Touch only these files:** `packages/sdk/src/program/{idl.json,pda,config,create-split}.ts`,
  `packages/sdk/src/index.ts` (append), `packages/sdk/__tests__/unit.test.ts` (append),
  `scripts/create-test-split.ts`, `package.json` (a script line), `README.md` (the program id).
- **Steps:**
  1. `anchor deploy` to devnet; record the program id in the README.
  2. Copy the IDL; write the three SDK functions; unit-test the PDA and the decode.
  3. `scripts/create-test-split.ts`: creates the test config through `buildCreateSplit`,
     prints its address.
  4. Hand the address to B for `NEXT_PUBLIC_SPLIT_CONFIG`.
- **Never:** reuse a key or a mint from Bujius Pay · put a keypair path in a committed file.
- **Done when:** the script prints the config address, and `fetchSplitConfig` on it returns the
  two recipients.

---

### A4 · SDK program strategy, `findPayment`, smoke, tx size — and the cut
**M** · Alexandre · `a/a4-program-strategy` · Fri 23:00–02:00

- **Depends:** `A3`, `B1`.
- **Why:** the program path has to prove itself on devnet before the night ends.
- **Already decided:** `buildSplitPayment` with `strategy: 'program'` as contracts §3 — the
  same signature `B1` wrote for `'transfers'` · `findPayment` per contracts §3 ·
  `scripts/smoke-pay.ts --strategy <s>`: payer keypair → builder → sign → send → `findPayment`
  → prints `PAID <signature>` and each leg's balance change · `scripts/measure-pay-tx.ts`:
  4 recipients, every destination missing → prints the byte count.
- **Touch only these files:** `packages/sdk/src/strategies/program.ts`,
  `packages/sdk/src/verify/find-payment.ts`, `packages/sdk/src/index.ts` (append),
  `packages/sdk/__tests__/unit.test.ts` (append), `scripts/{smoke-pay,measure-pay-tx}.ts`,
  `package.json` (script lines).
- **Steps:**
  1. The program strategy.
  2. `findPayment`.
  3. The smoke script; run it with `--strategy transfers`, then `--strategy program`.
  4. The size script.
  5. **Sat 02:00, the cut:** program smoke `PAID` → tell B `PAY_STRATEGY=program`. Otherwise
     `transfers` stays and program work stops.
- **Never:** change `buildSplitPayment`'s signature (it is B's contract too) · call
  `getTokenAccountsByOwner`.
- **Done when:** `pnpm smoke --strategy program` prints `PAID` (or the cut is called) ·
  the size script prints ≤ 1232.

---

### A5 · The verifier
**M** · Alexandre · `a/a5-verify` · Sat 09:00–11:30

- **Depends:** `A4`.
- **Why:** the program guarantees the split; only the verifier guarantees the amount.
- **Already decided:** `verifySplitPayment` as contracts §3 — balances, not instructions, so
  both strategies pass · `paid_late` after `expiresAt` · unit tests run on transaction fixtures
  saved from devnet runs (JSON files), no RPC in `verify`.
- **Touch only these files:** `packages/sdk/src/verify/verify-payment.ts`,
  `packages/sdk/__tests__/fixtures/*.json`, `packages/sdk/__tests__/unit.test.ts` (append),
  `packages/sdk/src/index.ts` (append), `scripts/smoke-pay.ts`.
- **Steps:**
  1. Save three fixtures: a program payment, a transfers payment, one with a wrong amount.
  2. The verifier.
  3. Tests: each fixture's verdict · `paid_late` · wrong mint · missing reference.
  4. The smoke script prints the verifier's verdict instead of the raw balances.
- **Never:** mark a payment `paid` from `findPayment` alone.
- **Done when:** `pnpm verify` green with the new tests · `pnpm smoke` prints `PAID` from the verifier.

---

### A6 · The gate run
**S** · Alexandre with B · `a/a6-gate-fixes` · Sat 11:30–14:00

- **Depends:** `A5`, `B6`.
- **Why:** the video's happy path is proven before anything else is added.
- **Already decided:** the gate is `PLAN.md` §8's — phone purchase through the program,
  verified, order page `Paid` · fixes only, no new feature.
- **Touch only these files:** whatever a fix needs, inside Track A's paths.
- **Steps:** 1. Run the store's purchase from Solflare on the phone. 2. Run it from a desktop
  extension. 3. Fix what breaks. 4. Tag `main` as `gate`.
- **Never:** start `A7` before the gate passes or is called.
- **Done when:** both runs end on `Paid` on the deployed store, and B has the backup footage.

---

### A7 · Verifiable build, licence check, npm `0.1.0`
**S** · Alexandre · `a/a7-verifiable` · Sat 14:00–16:00

- **Depends:** `A6`.
- **Why:** "open and verified" is half of the public-good argument.
- **Already decided:** `anchor build --verifiable` (Docker), upgrade the devnet program with
  that binary, publish the binary's hash in the README next to the program id · publish
  `@bujius/checkout-sdk` `0.1.0` publicly on npm.
- **Touch only these files:** `README.md`, `packages/sdk/package.json`.
- **Steps:** 1. Verifiable build. 2. `anchor upgrade` on devnet. 3. Compare the on-chain hash
  with the local one; write both in the README. 4. `npm publish --access public`.
- **Never:** change program code in this card — the binary must match the gate's source.
- **Done when:** the on-chain hash equals the local verifiable hash · `npm view @bujius/checkout-sdk`
  shows `0.1.0`.

---

### A8 · Hosted backend: schema, API keys, the charges API
**M** · Alexandre · `a/a8-hosted-api` · Sat 16:00–19:30

- **Depends:** `A7`, `B7`'s scaffold of `apps/hosted`.
- **Why:** the service layer for a store that hosts nothing.
- **Already decided:** contracts §6 tables and the three `/v1/charges` routes · Drizzle on
  Neon · strict zod bodies (an extra field is a 400) · API keys `sk_test_` + 32 random bytes,
  stored as SHA-256 · `scripts/create-merchant.ts` prints the key and the webhook secret once.
- **Touch only these files:** `apps/hosted/lib/db/{schema,client}.ts`, `apps/hosted/drizzle.config.ts`,
  `apps/hosted/drizzle/*`, `apps/hosted/lib/auth.ts`, `apps/hosted/app/api/v1/charges/**`,
  `apps/hosted/package.json` (append), `scripts/create-merchant.ts`.
- **Steps:** 1. Schema and the first migration on Neon. 2. Key auth. 3. `POST` and `GET`
  `/v1/charges`, idempotent on a pending `orderId`. 4. The merchant script with the test config.
- **Never:** accept a wallet, recipients, a config or a mint in a body · log an API key.
- **Done when:** `curl` with the key creates a charge and returns its `checkoutUrl` and
  `paymentUrl`; the same `orderId` returns the same charge.

---

### A9 · Hosted: transaction request, status, the flip, the webhook
**M** · Alexandre · `a/a9-hosted-pay` · Sat 19:30–23:00

- **Depends:** `A8`.
- **Why:** a hosted charge has to be payable and has to tell the store once.
- **Already decided:** contracts §6 — `/pay/:reference` through the SDK handler with the hold,
  the public status route with reconcile on read, the conditional flip, the signed webhook
  with one attempt and a delivery row, the resend route.
- **Touch only these files:** `apps/hosted/app/pay/[reference]/route.ts`,
  `apps/hosted/app/api/v1/charges/[id]/{status,webhook}/**`, `apps/hosted/lib/{flip,webhook}.ts`.
- **Steps:** 1. The pay route. 2. The status route and the flip. 3. The webhook sender and the
  resend route. 4. Pay a charge from the phone through B's page; watch one delivery row.
- **Never:** send the webhook from anywhere but the flip's winner.
- **Done when:** one phone payment → one `paid` row → exactly one `webhook_deliveries` row with a
  2xx from the demo store's receiver.

---

### A10 · Hosted: the Helius trigger
**S** · Alexandre · `a/a10-helius` · Sat 23:00–02:00

- **Depends:** `A9`.
- **Why:** a charge confirms even when nobody has the page open.
- **Already decided:** a Helius devnet webhook on the program id (and, after the cut, the test
  config's recipients) posting to `/hooks/helius` with `HELIUS_WEBHOOK_SECRET` · the handler
  runs the same verify-and-flip as the status route.
- **Touch only these files:** `apps/hosted/app/hooks/helius/route.ts`, `apps/hosted/lib/flip.ts`.
- **Steps:** 1. The route. 2. Register the webhook in Helius. 3. Pay with the checkout page
  closed; watch the charge turn `paid`.
- **Never:** let the hook's reply wait on the merchant's webhook.
- **Done when:** a payment with no page open turns the charge `paid` and sends one webhook.

---

### A11 · Sunday: fixes, freeze, the submission's links
**S** · Alexandre · `a/a11-fixes` · Sun 08:00–13:45

- **Depends:** everything that landed.
- **Already decided:** fixes only after 08:00 · **code freeze 11:00** · README links: program id,
  verifiable hash, npm, the two deployments, the video.
- **Steps:** 1. Fix what B's recording finds. 2. Freeze at 11:00. 3. Final §1 check. 4. Fill the
  Devpost links with B by 12:00; final by 13:45.
- **Never:** merge a feature after 08:00.
- **Done when:** the Devpost final submission is in.
