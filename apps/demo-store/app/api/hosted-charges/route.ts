import { formatUsdc, priceOrder } from '@/lib/catalog';
import { createHostedCharge, readHostedEnv } from '@/lib/hosted-api';
import { newOrderId } from '@/lib/order-token';
import { readStoreBaseUrl } from '@/lib/store-env';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const hosted = readHostedEnv();
  if (!hosted) {
    return Response.json({ error: 'This store does not use the hosted checkout.' }, { status: 404 });
  }

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

  try {
    const baseUrl = readStoreBaseUrl();
    const checkoutUrl = await createHostedCharge(hosted, {
      amount: formatUsdc(amount),
      orderId: newOrderId(),
      webhookUrl: `${baseUrl}/api/webhooks/bujius-checkout`,
      // The hosted checkout adds `chargeId`: the charge has no id yet.
      successUrl: `${baseUrl}/orders/hosted`,
    });
    return Response.json({ checkoutUrl });
  } catch (error) {
    console.error('Hosted charge failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json(
      { error: 'The hosted checkout is not available right now. Try again in a moment.' },
      { status: 503 },
    );
  }
}
