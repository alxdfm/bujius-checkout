# Bujius Checkout

An open Solana program and TypeScript SDK that split one payment between a merchant and its
partners in a single transaction, at the moment of the sale. The merchant writes the split once,
in an immutable on-chain config the partners can audit; every payment then pays each partner and
the merchant atomically, with no account per sale. The SDK ships the Solana Pay transaction
request handler a store hosts on its own backend, a verifier that confirms the amount by
reference, and React components for QR and connected-wallet payments. Built as the open split
primitive for Bujius Pay, during the MLH Solana Hackathon (November 2026). Devnet only.

| | |
|---|---|
| Program (devnet) | `LNv2EvYZFN1fBJeQPDGffRxVYPMCGpa99yCcWDSDdjN` |
| Verifiable build (SHA-256) | `7311c0155b90e5bb857bc1c2477ec46444ec6a6a555b9935f1dd7336ee76b984` — `anchor build --verifiable`; equals the bytecode deployed on devnet |
| `@bujius/checkout-sdk` | not published yet |
| `@bujius/checkout-react` | not published yet |

## Develop

```bash
pnpm install
pnpm verify          # typecheck, lint, unit tests, build
pnpm test:program    # anchor test (Anchor 0.31.1, Solana 4.2.2)
```

Verify the deployed program yourself: `anchor build --verifiable` (Docker), then compare
`sha256sum target/verifiable/bujius_checkout.so` with `solana program dump <program id> out.so -u devnet && sha256sum out.so`.

Interfaces: [`docs/CONTRACTS.md`](docs/CONTRACTS.md) · overview:
[`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md).

## License

MIT
