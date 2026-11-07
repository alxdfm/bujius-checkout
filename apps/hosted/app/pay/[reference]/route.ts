import {
  createTransactionRequestHandler,
  ErrorCode,
  isBujiusCheckoutError,
  type ResolveResult,
} from '@bujius/checkout-sdk';
import { PublicKey } from '@solana/web3.js';
import { and, eq, isNull, or } from 'drizzle-orm';
import { after } from 'next/server';
import { baseUrl } from '@/app/api/v1/charges/serialize';
import { getConnection, getSplitConfig } from '@/app/api/v1/charges/split-config';
import { getDb } from '@/lib/db/client';
import { charges, merchants } from '@/lib/db/schema';
import { reconcileCharge, sendFlipWebhook } from '@/lib/flip';

export const dynamic = 'force-dynamic';

/**
 * Contracts §6: reads the charge by its reference, then holds it for the first payer. A conditional
 * update sets `payer` only when it is empty or equal, so anyone else gets `ORDER_HELD`.
 */
async function resolve(reference: string, account: PublicKey): Promise<ResolveResult> {
  const db = getDb();
  const [row] = await db
    .select({ charge: charges, merchant: merchants })
    .from(charges)
    .innerJoin(merchants, eq(charges.merchantId, merchants.id))
    .where(eq(charges.reference, reference))
    .limit(1);
  if (!row) return { error: ErrorCode.ORDER_NOT_FOUND };

  let current = row.charge;
  try {
    const result = await reconcileCharge(row.charge, row.merchant);
    current = result.charge;
    const { flipped } = result;
    if (flipped) after(() => sendFlipWebhook(flipped, row.merchant));
  } catch (error) {
    if (isBujiusCheckoutError(error) && error.code === ErrorCode.RPC_UNAVAILABLE) {
      return { error: ErrorCode.RPC_UNAVAILABLE };
    }
    throw error;
  }

  if (current.status === 'paid' || current.status === 'paid_late') return { error: ErrorCode.ORDER_PAID };
  // The grace window is for a payment already signed, not for starting a new one.
  if (current.status === 'expired' || Date.now() >= current.expiresAt.getTime()) {
    return { error: ErrorCode.ORDER_EXPIRED };
  }

  const held = await db
    .update(charges)
    .set({ payer: account.toBase58() })
    .where(
      and(
        eq(charges.id, current.id),
        eq(charges.status, 'pending'),
        or(isNull(charges.payer), eq(charges.payer, account.toBase58())),
      ),
    )
    .returning({ id: charges.id });
  if (held.length === 0) return { error: ErrorCode.ORDER_HELD };

  return {
    config: await getSplitConfig(row.merchant.splitConfig),
    amount: BigInt(current.amount),
    reference: new PublicKey(current.reference),
    message: `Payment to ${row.merchant.name}`,
  };
}

async function handle(request: Request): Promise<Response> {
  const handler = createTransactionRequestHandler({
    connection: getConnection(),
    label: 'Bujius Checkout',
    iconUrl: `${baseUrl(request)}/icon.svg`,
    strategy: process.env.PAY_STRATEGY === 'transfers' ? 'transfers' : 'program',
    resolve,
  });
  return handler(request);
}

export { handle as GET, handle as POST, handle as OPTIONS };
