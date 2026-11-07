import type { Connection, PublicKey } from '@solana/web3.js';
import { BujiusCheckoutError, ErrorCode } from '../errors';

/** Successful signatures that mention `reference`, at `confirmed`, newest first. */
async function successfulSignatures(connection: Connection, reference: PublicKey): Promise<string[]> {
  let signatures;
  try {
    signatures = await connection.getSignaturesForAddress(reference, undefined, 'confirmed');
  } catch {
    throw new BujiusCheckoutError(ErrorCode.RPC_UNAVAILABLE);
  }
  return signatures.filter((s) => s.err === null).map((s) => s.signature);
}

/**
 * The first successful signature that mentions `reference`, at `confirmed`, or `null`.
 * Finding a signature does not mean the amount is right: only `verifySplitPayment` decides.
 * Anyone holding the reference can send another amount first, so a caller that must not be
 * blocked by that uses `findPayments` and verifies each one.
 */
export async function findPayment(
  connection: Connection,
  reference: PublicKey,
): Promise<string | null> {
  const successful = await successfulSignatures(connection, reference);
  // Newest first: the earliest successful one is the last of them
  return successful.at(-1) ?? null;
}

/**
 * Every successful signature that mentions `reference`, at `confirmed`, earliest first. A wrong
 * amount sent to the reference first does not hide the right one: verify each with
 * `verifySplitPayment` and take the first that is `paid` or `paid_late`.
 */
export async function findPayments(
  connection: Connection,
  reference: PublicKey,
): Promise<string[]> {
  return (await successfulSignatures(connection, reference)).reverse();
}
