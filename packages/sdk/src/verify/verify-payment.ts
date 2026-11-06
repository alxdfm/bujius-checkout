import type { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
import { computeSplit } from '../core/split-math';
import { BujiusCheckoutError, ErrorCode } from '../errors';
import type { SplitConfig } from '../program/config';

export interface VerifiedLeg {
  wallet: PublicKey;
  /** What the wallet's token balance of `config.mint` actually rose by. */
  amount: bigint;
}

export interface Verification {
  status: 'paid' | 'paid_late' | 'invalid';
  reason?: string;
  /** Recipients in config order, then the merchant. */
  legs: VerifiedLeg[];
}

type TokenBalance = NonNullable<
  NonNullable<ParsedTransactionWithMeta['meta']>['preTokenBalances']
>[number];

/** Sum of the owner's balances of `mint`, in base units. */
function totals(balances: readonly TokenBalance[] | null | undefined, mint: string) {
  const byOwner = new Map<string, bigint>();
  for (const b of balances ?? []) {
    if (b.mint !== mint || !b.owner) continue;
    byOwner.set(b.owner, (byOwner.get(b.owner) ?? 0n) + BigInt(b.uiTokenAmount.amount));
  }
  return byOwner;
}

/**
 * Judges a transaction by balances, not instructions, so both strategies pass: it succeeded,
 * the reference is among its account keys, and the balance of the merchant and of each
 * recipient (in `config.mint`) rose by exactly `computeSplit(amount)`. A `blockTime` after
 * `expiresAt` is `paid_late`. The program guarantees the split; this guarantees the amount.
 */
export async function verifySplitPayment(
  connection: Connection,
  signature: string,
  config: SplitConfig,
  amount: bigint,
  reference: PublicKey,
  expiresAt?: Date,
): Promise<Verification> {
  const expected = computeSplit(
    amount,
    config.recipients.map((r) => r.bps),
  );
  const wallets = [...config.recipients.map((r) => r.wallet), config.authority];
  const expectedAmounts = [...expected.shares, expected.merchant];
  const invalid = (reason: string, legs: VerifiedLeg[] = []): Verification => ({
    status: 'invalid',
    reason,
    legs,
  });

  let tx: ParsedTransactionWithMeta | null;
  try {
    tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
  } catch {
    throw new BujiusCheckoutError(ErrorCode.RPC_UNAVAILABLE);
  }
  if (!tx || !tx.meta) return invalid('transaction not found');
  if (tx.meta.err !== null) return invalid('transaction failed');

  const referenceKey = reference.toBase58();
  if (!tx.transaction.message.accountKeys.some((k) => String(k.pubkey) === referenceKey)) {
    return invalid('reference not in the transaction');
  }

  const mint = config.mint.toBase58();
  const pre = totals(tx.meta.preTokenBalances, mint);
  const post = totals(tx.meta.postTokenBalances, mint);
  const legs: VerifiedLeg[] = wallets.map((wallet) => {
    const key = wallet.toBase58();
    return { wallet, amount: (post.get(key) ?? 0n) - (pre.get(key) ?? 0n) };
  });

  for (let i = 0; i < legs.length; i++) {
    if (legs[i]!.amount !== expectedAmounts[i]!) {
      return invalid(
        `${legs[i]!.wallet.toBase58()} received ${legs[i]!.amount}, expected ${expectedAmounts[i]!}`,
        legs,
      );
    }
  }

  const late =
    expiresAt !== undefined &&
    tx.blockTime != null &&
    tx.blockTime * 1000 > expiresAt.getTime();
  return { status: late ? 'paid_late' : 'paid', legs };
}
