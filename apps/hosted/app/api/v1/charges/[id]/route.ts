import { and, desc, eq } from 'drizzle-orm';
import { authenticate } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { charges, webhookDeliveries } from '@/lib/db/schema';
import { errorResponse, chargeNotFound, unauthorized } from '../errors';
import { baseUrl, chargeJson } from '../serialize';
import { getSplitMint } from '../split-config';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const merchant = await authenticate(request);
  if (!merchant) return unauthorized();

  const { id } = await params;
  const db = getDb();
  // Another merchant's charge is a 404, not a 403: its existence is not ours to confirm.
  const [charge] = await db
    .select()
    .from(charges)
    .where(and(eq(charges.id, id), eq(charges.merchantId, merchant.id)))
    .limit(1);
  if (!charge) return chargeNotFound();

  let mint: string;
  try {
    mint = await getSplitMint(merchant.splitConfig);
  } catch {
    return errorResponse(502, 'SPLIT_CONFIG_UNAVAILABLE', "Could not read the merchant's split config.");
  }

  const [last] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.chargeId, charge.id))
    .orderBy(desc(webhookDeliveries.sentAt))
    .limit(1);

  return Response.json({
    ...chargeJson(charge, mint, baseUrl(request)),
    orderId: charge.orderId,
    signature: charge.signature,
    paidAt: charge.paidAt?.toISOString() ?? null,
    webhook: {
      lastStatusCode: last?.statusCode ?? null,
      lastSentAt: last?.sentAt.toISOString() ?? null,
    },
  });
}
