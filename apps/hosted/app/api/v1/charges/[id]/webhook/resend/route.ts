import { and, eq } from 'drizzle-orm';
import { authenticate } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { charges } from '@/lib/db/schema';
import { deliverWebhook, eventTypeFor } from '@/lib/webhook';
import { chargeNotFound, errorResponse, unauthorized } from '../../../errors';
import { getSplitMint } from '../../../split-config';

export const dynamic = 'force-dynamic';

/** Sends the charge's event again, once, and answers with what the receiver said. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const merchant = await authenticate(request);
  if (!merchant) return unauthorized();

  const { id } = await params;
  const [charge] = await getDb()
    .select()
    .from(charges)
    .where(and(eq(charges.id, id), eq(charges.merchantId, merchant.id)))
    .limit(1);
  if (!charge) return chargeNotFound();

  const type = eventTypeFor(charge.status);
  if (!type) {
    return errorResponse(409, 'CHARGE_NOT_PAID', 'There is no event to send until the charge is paid.');
  }
  if (!charge.webhookUrl) {
    return errorResponse(409, 'NO_WEBHOOK_URL', 'This charge was created without a webhookUrl.');
  }

  let mint: string;
  try {
    mint = await getSplitMint(merchant.splitConfig);
  } catch {
    return errorResponse(502, 'SPLIT_CONFIG_UNAVAILABLE', "Could not read the merchant's split config.");
  }
  const result = await deliverWebhook(charge, merchant, mint, type);
  return Response.json({ event: type, ...result });
}
