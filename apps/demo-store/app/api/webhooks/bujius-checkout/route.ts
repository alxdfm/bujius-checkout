import { isValidWebhookSignature } from '@/lib/webhook-signature';

export const dynamic = 'force-dynamic';

interface WebhookEvent {
  id: string;
  type: string;
}

/** The signed body as an event, or `null`: a signature proves who sent it, not what it holds. */
function readEvent(rawBody: Uint8Array): WebhookEvent | null {
  try {
    const event = JSON.parse(Buffer.from(rawBody).toString()) as Partial<WebhookEvent> | null;
    return typeof event?.id === 'string' && typeof event.type === 'string' ? (event as WebhookEvent) : null;
  } catch {
    return null;
  }
}

/** Contracts §6: checks the signature, logs the event and keeps nothing. The store has no state. */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.HOSTED_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing environment variable HOSTED_WEBHOOK_SECRET');
    return Response.json({ error: 'This store cannot receive webhooks yet.' }, { status: 500 });
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  const header = request.headers.get('BujiusCheckout-Signature');
  // A captured request can be sent again inside the time window. Here that only repeats a log line:
  // a handler that acts on the event has to refuse an `id` it has already seen.
  if (!isValidWebhookSignature(header, rawBody, secret, Math.floor(Date.now() / 1000))) {
    return Response.json({ error: 'This signature is not valid.' }, { status: 401 });
  }

  const event = readEvent(rawBody);
  if (!event) {
    return Response.json({ error: 'We could not read this event.' }, { status: 400 });
  }

  console.log('Webhook received', event);
  return Response.json({ received: true });
}
