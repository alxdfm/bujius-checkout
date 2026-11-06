# Code style

## TypeScript

- `strict` everywhere (`tsconfig.base.json`); no `any` — `unknown` and narrow.
- **Money is `bigint` in base units.** Parse decimal strings with `toBaseUnits` at the edge;
  format with `fromBaseUnits` at the edge. No `Number(…)` on an amount, ever.
- Errors are **codes**: throw `BujiusCheckoutError(ErrorCode.X)`; the sentence lives where the
  payer reads it (the handler's table, a screen). Logs and error messages in English.
- Async: no `forEach` with async callbacks — `for…of` or `Promise.all`.
- Lookups: build a `Map` instead of repeated `find`/`filter` on the same array.
- RPC: batch reads with `getMultipleAccountsInfo`; commitment `confirmed` unless a card says
  otherwise.
- The SDK runs in Node **and** the browser: no `fs`, no Node-only `crypto` in `packages/sdk/src`
  outside `server/`; web-standard `Request`/`Response` in the handler.
- Exports go through `packages/sdk/src/index.ts` — append-only, each track its own lines.
- Tests: vitest, `__tests__/unit.test.ts` (no RPC) and `__tests__/integration.test.ts` (devnet,
  never in `verify`). Fixtures as JSON in `__tests__/fixtures/`.
- Files `kebab-case.ts`; components `kebab-case.tsx` exporting `PascalCase`.

## Rust (the program)

- Checked arithmetic only (`checked_mul`, `checked_div`, `checked_sub`) with `u128`
  intermediates; an overflow is `MathOverflow`, never a panic.
- One instruction per file in `instructions/`; `state.rs`, `errors.rs`, `events.rs` beside
  `lib.rs`.
- Every check has its own error variant (contracts §1) and its own test.
- `transfer_checked`, never `transfer`.
- Validate every `remaining_accounts` entry against the recipient it should be — never rely on
  order alone.
- `cargo fmt` before commit.
