import { newReference } from '@bujius/checkout-sdk';
import { and, eq } from 'drizzle-orm';
import { authenticate } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { charges, newId } from '@/lib/db/schema';
import { createChargeBody, describeIssue } from './body';
import { errorResponse, unauthorized } from './errors';
import { baseUrl, chargeJson, effectiveStatus } from './serialize';
import { getSplitMint } from './split-config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const merchant = await authenticate(request);
  if (!merchant) return unauthorized();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, 'INVALID_BODY', 'The body must be JSON.');
  }
  const parsed = createChargeBody.safeParse(raw);
  if (!parsed.success) return errorResponse(400, 'INVALID_BODY', describeIssue(parsed.error));
  const body = parsed.data;

  let mint: string;
  try {
    mint = await getSplitMint(merchant.splitConfig);
  } catch {
    return errorResponse(502, 'SPLIT_CONFIG_UNAVAILABLE', "Could not read the merchant's split config.");
  }

  const db = getDb();
  const amount = body.amount.toString();
  const inserted = await db
    .insert(charges)
    .values({
      id: newId('ch'),
      merchantId: merchant.id,
      reference: newReference().toBase58(),
      amount,
      orderId: body.orderId,
      webhookUrl: body.webhookUrl ?? null,
      successUrl: body.successUrl ?? null,
      expiresAt: new Date(Date.now() + body.expiresInSeconds * 1000),
    })
    .onConflictDoNothing({ target: [charges.merchantId, charges.orderId] })
    .returning();

  const origin = baseUrl(request);
  if (inserted[0]) return Response.json(chargeJson(inserted[0], mint, origin), { status: 201 });

  // Same `orderId` again: a pending charge for the same amount is the same charge.
  const [existing] = await db
    .select()
    .from(charges)
    .where(and(eq(charges.merchantId, merchant.id), eq(charges.orderId, body.orderId)))
    .limit(1);
  if (existing && effectiveStatus(existing) === 'pending' && existing.amount === amount) {
    return Response.json(chargeJson(existing, mint, origin), { status: 200 });
  }
  return errorResponse(
    409,
    'ORDER_ID_IN_USE',
    'A charge with this orderId already exists and is not pending, or has another amount.',
  );
}
