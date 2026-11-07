import { eq } from 'drizzle-orm';
import { after } from 'next/server';
import { getDb } from '@/lib/db/client';
import { charges, merchants } from '@/lib/db/schema';
import { reconcileCharge, sendFlipWebhook } from '@/lib/flip';
import { chargeNotFound } from '../../errors';
import { effectiveStatus } from '../../serialize';

export const dynamic = 'force-dynamic';

/**
 * Public (contracts §6): the hosted checkout page polls it. While the charge is `pending` it asks
 * the chain first. If the chain cannot be read, the stored state is answered rather than an error.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const db = getDb();
  const [row] = await db
    .select({ charge: charges, merchant: merchants })
    .from(charges)
    .innerJoin(merchants, eq(charges.merchantId, merchants.id))
    .where(eq(charges.id, id))
    .limit(1);
  if (!row) return chargeNotFound();

  let current = row.charge;
  try {
    const result = await reconcileCharge(row.charge, row.merchant);
    current = result.charge;
    const { flipped } = result;
    if (flipped) after(() => sendFlipWebhook(flipped, row.merchant));
  } catch (error) {
    console.error(`Reconcile on read failed: ${error instanceof Error ? error.name : 'error'}`);
  }

  return Response.json(
    {
      status: effectiveStatus(current),
      signature: current.signature,
      reference: current.reference,
      amount: current.amount,
      expiresAt: current.expiresAt.toISOString(),
      successUrl: current.successUrl,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
