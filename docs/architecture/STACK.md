# Stack

> **The allowed versions and dependencies are `docs/planning/PLAN.md` §5** — that table is the
> source of truth; this file is the local setup and what not to use.

## Toolchain

| Tool | Version | Where it is pinned |
|---|---|---|
| Node | 22 (CI) — ≥ 22 locally | `.nvmrc`, `package.json` `engines` |
| pnpm | 11.18.0 | `package.json` `packageManager` |
| Anchor CLI · `anchor-lang` | 0.31.1 | `Anchor.toml` `[toolchain]`, `programs/bujius-checkout/Cargo.toml` |
| `@coral-xyz/anchor` | **0.31.1, no caret** | root `package.json` — one minor ahead reads the IDL differently, silently |
| Solana CLI (Agave) | 4.2.2 | `Anchor.toml` `[toolchain] solana_version` |

`Anchor.toml` holds no comments — `anchor build` rewrites the file and drops them.

## Local setup

```bash
pnpm install
pnpm verify                 # must exit 0
pnpm test:program           # anchor test — needs the Solana toolchain
```

If `anchor` says `agave-install` is unavailable, the Solana release is installed but not on the
`PATH`: add `~/.local/share/solana/install/active_release/bin` to it.

Keypairs (deployer, merchant, partner, test payer, the program's) live **outside the
repository**; scripts get their paths from `DEPLOYER_KEYPAIR`, `MERCHANT_KEYPAIR`,
`PAYER_KEYPAIR`. Env vars per app: contracts §7.

## Install-time build scripts

`pnpm-workspace.yaml` → `allowBuilds` approves only what breaks without its build (`esbuild`).
A new entry there gets a one-line comment saying why.

## What not to use

| Not | Instead | Why |
|---|---|---|
| `getTokenAccountsByOwner` | derive the ATA, `getMultipleAccountsInfo` | the public devnet RPC throttles it first |
| `number` / floats for amounts | `bigint` base units | money |
| Token-2022 | classic SPL Token | out of scope (contracts §1) |
| `@solana/kit` / web3.js 2.x | `@solana/web3.js` 1.98 | `@solana/pay` and wallet-adapter build on 1.x |
| A hard-coded wallet list | Wallet Standard discovery | contracts §5 |
| `@coral-xyz/anchor` with a caret | the exact `0.31.1` | IDL compatibility |
| A database in the demo store | the signed order token | the chain is the source of truth |
