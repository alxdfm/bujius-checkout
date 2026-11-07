import { timingSafeEqual } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { after } from 'next/server';
import { getDb } from '@/lib/db/client';
import { charges, merchants } from '@/lib/db/schema';
import { readHeliusTransactions, reconcileCharge, sendFlipWebhook } from '@/lib/flip';

export const dynamic = 'force-dynamic';

function authorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  const received = Buffer.from(header);
  const expected = Buffer.from(secret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Contracts §6: Helius posts each transaction on the program (register the webhook as `rawDevnet`,
 * so the reference — a readonly account — is among the account keys). For every pending charge whose
 * `reference` is among them, the same verify-and-flip as the status route runs. The reply is `200`
 * at once: the work and the merchant's webhook happen after it, never before.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing environment variable HELIUS_WEBHOOK_SECRET');
    return Response.json({ error: { code: 'NOT_CONFIGURED', message: 'This endpoint is not configured.' } }, { status: 500 });
  }
  if (!authorized(request.headers.get('authorization'), secret)) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid authorization.' } }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: { code: 'INVALID_BODY', message: 'The body must be JSON.' } }, { status: 400 });
  }

  const references = [...new Set(readHeliusTransactions(payload).flatMap((tx) => tx.keys))];
  if (references.length > 0) after(() => settle(references));
  return Response.json({ received: true });
}

async function settle(references: string[]): Promise<void> {
  try {
    const rows = await getDb()
      .select({ charge: charges, merchant: merchants })
      .from(charges)
      .innerJoin(merchants, eq(charges.merchantId, merchants.id))
      .where(and(inArray(charges.reference, references), eq(charges.status, 'pending')));
    for (const { charge, merchant } of rows) {
      try {
        const { flipped } = await reconcileCharge(charge, merchant);
        if (flipped) await sendFlipWebhook(flipped, merchant);
      } catch (error) {
        console.error(`Helius reconcile failed for ${charge.id}: ${error instanceof Error ? error.name : 'error'}`);
      }
    }
  } catch (error) {
    console.error(`Helius hook failed: ${error instanceof Error ? error.name : 'error'}`);
  }
}
