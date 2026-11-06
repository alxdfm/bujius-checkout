import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  unpackMint,
} from '@solana/spl-token';
import { PublicKey, Transaction, type Connection } from '@solana/web3.js';
import { computeSplit } from '../core/split-math';
import { BujiusCheckoutError, ErrorCode } from '../errors';
import type { SplitConfig } from '../program/config';

export type PaymentStrategy = 'program' | 'transfers';

const U64_MAX = 18_446_744_073_709_551_615n;

/**
 * Builds an unsigned legacy split payment. Fee payer = payer; blockhash at `confirmed`.
 * `'transfers'` is implemented here; `'program'` is filled by A4.
 * An amount outside 1..=u64::MAX throws `INVALID_AMOUNT` for either strategy.
 * A payer who is also a leg's wallet throws `INVALID_ACCOUNT` for either strategy: its balance
 * would not rise by that leg's amount, so the verifier could never mark the payment paid.
 * An off-curve payer throws `INVALID_ACCOUNT` too: it has no private key to sign with.
 */
export async function buildSplitPayment(
  connection: Connection,
  config: SplitConfig,
  payer: PublicKey,
  amount: bigint,
  reference: PublicKey,
  strategy: PaymentStrategy,
): Promise<Transaction> {
  if (amount <= 0n || amount > U64_MAX) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_AMOUNT);
  }
  if (
    !PublicKey.isOnCurve(payer) ||
    payer.equals(config.authority) ||
    config.recipients.some((r) => r.wallet.equals(payer))
  ) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_ACCOUNT);
  }
  if (strategy === 'program') {
    throw new Error('program strategy not implemented');
  }
  if (strategy !== 'transfers') {
    throw new Error(`unknown payment strategy: ${String(strategy)}`);
  }
  return buildTransfersPayment(connection, config, payer, amount, reference);
}

async function buildTransfersPayment(
  connection: Connection,
  config: SplitConfig,
  payer: PublicKey,
  amount: bigint,
  reference: PublicKey,
): Promise<Transaction> {
  const { shares, merchant } = computeSplit(
    amount,
    config.recipients.map((r) => r.bps),
  );

  const legs: { wallet: PublicKey; amount: bigint }[] = [];
  for (let i = 0; i < config.recipients.length; i++) {
    const share = shares[i]!;
    if (share > 0n) {
      legs.push({ wallet: config.recipients[i]!.wallet, amount: share });
    }
  }
  if (merchant > 0n) {
    legs.push({ wallet: config.authority, amount: merchant });
  }

  // A leg's wallet may be a PDA or a multisig vault: contracts §1 has no on-curve rule.
  const ataOf = (wallet: PublicKey) =>
    getAssociatedTokenAddressSync(config.mint, wallet, true);
  const destAtas = legs.map((leg) => ataOf(leg.wallet));
  const source = ataOf(payer);

  let infos;
  try {
    infos = await connection.getMultipleAccountsInfo(
      [...destAtas, config.mint, source],
      'confirmed',
    );
  } catch {
    throw new BujiusCheckoutError(ErrorCode.RPC_UNAVAILABLE);
  }

  const mintInfo = infos[destAtas.length];
  const sourceInfo = infos[destAtas.length + 1];
  if (!mintInfo || !sourceInfo) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_ACCOUNT);
  }
  let decimals: number;
  try {
    decimals = unpackMint(config.mint, mintInfo).decimals;
  } catch (cause) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_ACCOUNT, { cause });
  }

  const tx = new Transaction();
  for (let i = 0; i < destAtas.length; i++) {
    if (infos[i] == null) {
      const leg = legs[i]!;
      const ata = destAtas[i]!;
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          ata,
          leg.wallet,
          config.mint,
        ),
      );
    }
  }

  let firstTransfer = true;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    const destination = destAtas[i]!;
    const ix = createTransferCheckedInstruction(
      source,
      config.mint,
      destination,
      payer,
      leg.amount,
      decimals,
    );
    if (firstTransfer) {
      ix.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
      firstTransfer = false;
    }
    tx.add(ix);
  }

  let blockhash: string;
  let lastValidBlockHeight: number;
  try {
    ({ blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash('confirmed'));
  } catch {
    throw new BujiusCheckoutError(ErrorCode.RPC_UNAVAILABLE);
  }
  tx.feePayer = payer;
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  return tx;
}
