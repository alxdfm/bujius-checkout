import {
  BujiusCheckoutError,
  ErrorCode,
  findPayment,
  verifySplitPayment,
  type VerifiedLeg,
} from '@bujius/checkout-sdk';
import { PublicKey } from '@solana/web3.js';
import type { OrderPayload } from './order-token';
import type { StoreChain } from './store-chain';

/**
 * A transaction built just before the expiry can still land until its blockhash dies, about 90
 * seconds later. Until then the order stays `pending`, so that payment is seen as `paid_late`
 * instead of being told `expired`.
 */
export const EXPIRY_GRACE_SECONDS = 90;

// The RPC can list a signature before it serves the transaction. That is not a verdict.
const NOT_SERVED_YET = 'transaction not found';

export type OrderStatus =
  | { status: 'pending' }
  | { status: 'expired' }
  | { status: 'paid' | 'paid_late' | 'invalid'; signature: string; legs: VerifiedLeg[] };

/** A failure that trying again can fix. Anything else (a wrong env var or config) is not "busy". */
export const isNetworkBusy = (error: unknown) =>
  error instanceof BujiusCheckoutError && error.code === ErrorCode.RPC_UNAVAILABLE;

/** `findPayment` finds the transaction and only `verifySplitPayment` decides. Throws `RPC_UNAVAILABLE`. */
export async function readOrderStatus(
  chain: StoreChain,
  order: OrderPayload,
  nowSeconds: number,
): Promise<OrderStatus> {
  const reference = new PublicKey(order.r);
  const signature = await findPayment(chain.connection, reference);
  if (signature === null) {
    return nowSeconds >= order.e + EXPIRY_GRACE_SECONDS ? { status: 'expired' } : { status: 'pending' };
  }
  const verification = await verifySplitPayment(
    chain.connection,
    signature,
    await chain.loadConfig(),
    BigInt(order.a),
    reference,
    new Date(order.e * 1000),
  );
  if (verification.status === 'invalid' && verification.reason === NOT_SERVED_YET) {
    return { status: 'pending' };
  }
  return { status: verification.status, signature, legs: verification.legs };
}
