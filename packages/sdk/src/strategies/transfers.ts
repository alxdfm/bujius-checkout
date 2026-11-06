import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  unpackMint,
} from '@solana/spl-token';
import {
  Transaction,
  type Connection,
  type PublicKey,
} from '@solana/web3.js';
import { computeSplit } from '../core/split-math';
import { BujiusCheckoutError, ErrorCode } from '../errors';
import type { SplitConfig } from '../program/config';

export type PaymentStrategy = 'program' | 'transfers';

const U64_MAX = 18_446_744_073_709_551_615n;

/**
 * Builds an unsigned legacy split payment. Fee payer = payer; blockhash at `confirmed`.
 * `'transfers'` is implemented here; `'program'` is filled by A4.
 * An amount outside 1..=u64::MAX throws `INVALID_AMOUNT` for either strategy.
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

  const destAtas = legs.map((leg) =>
    getAssociatedTokenAddressSync(config.mint, leg.wallet),
  );

  let infos;
  try {
    infos = await connection.getMultipleAccountsInfo(
      [...destAtas, config.mint],
      'confirmed',
    );
  } catch {
    throw new BujiusCheckoutError(ErrorCode.RPC_UNAVAILABLE);
  }

  const mintInfo = infos[destAtas.length];
  if (!mintInfo) {
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

  const source = getAssociatedTokenAddressSync(config.mint, payer);
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
