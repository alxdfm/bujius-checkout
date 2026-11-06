import type { Connection, PublicKey } from '@solana/web3.js';
import { BujiusCheckoutError, ErrorCode } from '../errors';

/**
 * The first successful signature that mentions `reference`, at `confirmed`, or `null`.
 * Finding a signature does not mean the amount is right: only `verifySplitPayment` decides.
 */
export async function findPayment(
  connection: Connection,
  reference: PublicKey,
): Promise<string | null> {
  let signatures;
  try {
    signatures = await connection.getSignaturesForAddress(reference, undefined, 'confirmed');
  } catch {
    throw new BujiusCheckoutError(ErrorCode.RPC_UNAVAILABLE);
  }
  // Newest first: the earliest successful one is the last of them
  const successful = signatures.filter((s) => s.err === null);
  return successful.length > 0 ? successful[successful.length - 1]!.signature : null;
}
