import anchor, { BorshInstructionCoder, type Idl } from '@coral-xyz/anchor';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Transaction,
  TransactionInstruction,
  type Connection,
  type PublicKey,
} from '@solana/web3.js';
import { computeSplit } from '../core/split-math';
import { BujiusCheckoutError, ErrorCode } from '../errors';
import type { SplitConfig } from '../program/config';
import idl from '../program/idl.json';
import { PROGRAM_ID } from '../program/pda';

// Node's ESM loader cannot see `BN` as a named export of this CommonJS package.
const { BN } = anchor;
const coder = new BorshInstructionCoder(idl as Idl);

/**
 * The `'program'` strategy: an idempotent ATA create for each missing destination that
 * receives funds, then `pay`. The program creates no account itself. Amount and payer are
 * validated by `buildSplitPayment` before this runs.
 */
export async function buildProgramPayment(
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

  const ataOf = (wallet: PublicKey) =>
    getAssociatedTokenAddressSync(config.mint, wallet, true);
  const merchantToken = ataOf(config.authority);
  const recipientAtas = config.recipients.map((r) => ataOf(r.wallet));
  const source = ataOf(payer);

  // Destinations that receive funds (a zero leg is skipped by the program)
  const funded = [
    ...config.recipients
      .map((r, i) => ({ wallet: r.wallet, ata: recipientAtas[i]!, amount: shares[i]! }))
      .filter((leg) => leg.amount > 0n),
    ...(merchant > 0n
      ? [{ wallet: config.authority, ata: merchantToken, amount: merchant }]
      : []),
  ];

  let infos;
  try {
    infos = await connection.getMultipleAccountsInfo(
      [...funded.map((leg) => leg.ata), source],
      'confirmed',
    );
  } catch {
    throw new BujiusCheckoutError(ErrorCode.RPC_UNAVAILABLE);
  }
  if (!infos[funded.length]) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_ACCOUNT);
  }

  const tx = new Transaction();
  for (let i = 0; i < funded.length; i++) {
    if (infos[i] == null) {
      const leg = funded[i]!;
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(payer, leg.ata, leg.wallet, config.mint),
      );
    }
  }

  tx.add(
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: false },
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: config.address, isSigner: false, isWritable: false },
        { pubkey: config.mint, isSigner: false, isWritable: false },
        { pubkey: merchantToken, isSigner: false, isWritable: true },
        { pubkey: reference, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // remaining accounts, in config.recipients order
        ...recipientAtas.map((pubkey) => ({ pubkey, isSigner: false, isWritable: true })),
      ],
      data: coder.encode('pay', { amount: new BN(amount.toString()) }),
    }),
  );

  let blockhash: string;
  let lastValidBlockHeight: number;
  try {
    ({ blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed'));
  } catch {
    throw new BujiusCheckoutError(ErrorCode.RPC_UNAVAILABLE);
  }
  tx.feePayer = payer;
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  return tx;
}
