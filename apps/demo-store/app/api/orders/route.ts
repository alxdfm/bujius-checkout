import { newReference, paymentUrl } from '@bujius/checkout-sdk';
import { formatUsdc, priceOrder } from '@/lib/catalog';
import { createOrderToken, newOrderId, ORDER_TTL_SECONDS } from '@/lib/order-token';
import { readStoreEnv } from '@/lib/store-env';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'We could not read this order.' }, { status: 400 });
  }

  // The amount comes from the catalog: anything else in the body is ignored.
  const amount = priceOrder((body as { items?: unknown } | null)?.items);
  if (amount === null) {
    return Response.json({ error: 'This order has an item we do not sell.' }, { status: 400 });
  }

  const { baseUrl, orderSecret } = readStoreEnv();
  const reference = newReference().toBase58();
  const expiresAt = Math.floor(Date.now() / 1000) + ORDER_TTL_SECONDS;
  const token = createOrderToken(
    { v: 1, o: newOrderId(), a: amount.toString(), r: reference, e: expiresAt },
    orderSecret,
  );

  return Response.json({
    token,
    checkoutUrl: `${baseUrl}/checkout/${token}`,
    paymentUrl: paymentUrl(`${baseUrl}/api/pay/${token}`),
    amount: formatUsdc(amount),
    reference,
    expiresAt,
  });
}
