import { createHash, createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './db/client';
import { newId, webhookDeliveries, type Charge, type Merchant } from './db/schema';

export const WEBHOOK_TIMEOUT_MS = 5000;

export type WebhookEventType = 'charge.paid' | 'charge.paid_late';

export function eventTypeFor(status: Charge['status']): WebhookEventType | null {
  if (status === 'paid') return 'charge.paid';
  if (status === 'paid_late') return 'charge.paid_late';
  return null;
}

/** Contracts §6: `t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`. */
export function signWebhook(secret: string, rawBody: string, timestamp: number): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

/** Same event, same id: a receiver can drop a redelivery it has already handled. */
export function eventId(chargeId: string, type: WebhookEventType): string {
  return `evt_${createHash('sha256').update(`${chargeId}:${type}`).digest('hex').slice(0, 24)}`;
}

/** The exact bytes that are signed and sent. */
export function buildWebhookBody(charge: Charge, mint: string, type: WebhookEventType): string {
  return JSON.stringify({
    id: eventId(charge.id, type),
    type,
    createdAt: new Date().toISOString(),
    data: {
      chargeId: charge.id,
      orderId: charge.orderId,
      reference: charge.reference,
      amount: charge.amount,
      mint,
      signature: charge.signature,
      paidAt: charge.paidAt?.toISOString() ?? null,
    },
  });
}

function isInternalV4(ip: string): boolean {
  const [a = 0, b = 0, c = 0] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** Loopback, private, link-local and reserved addresses, v4 and v6. */
export function isInternalAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  const family = isIP(ip);
  if (family === 4) return isInternalV4(ip);
  if (family !== 6) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped?.[1]) return isInternalV4(mapped[1]);
  return (
    ip === '::' ||
    ip === '::1' ||
    ip.startsWith('fc') ||
    ip.startsWith('fd') ||
    /^fe[89ab]/.test(ip) ||
    ip.startsWith('ff')
  );
}

type Resolver = (hostname: string) => Promise<{ address: string }[]>;

const resolveAll: Resolver = (hostname) => lookup(hostname, { all: true });

/**
 * The webhook goes only to a public HTTPS host: no localhost, no private or link-local address,
 * and no hostname that resolves to one. Redirects are never followed (see `deliverWebhook`).
 * A host that changes its answer between this check and the request is not covered.
 */
export async function assertPublicWebhookUrl(
  value: string,
  resolver: Resolver = resolveAll,
): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('The webhook URL must use https.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || /\.(localhost|local|internal)$/.test(host)) {
    throw new Error('The webhook URL points to an internal host.');
  }
  const addresses = isIP(host.replace(/^\[|\]$/g, '')) ? [{ address: host }] : await resolver(host);
  if (addresses.length === 0 || addresses.some((a) => isInternalAddress(a.address))) {
    throw new Error('The webhook URL points to an internal host.');
  }
}

export interface DeliveryResult {
  attempt: number;
  statusCode: number | null;
  error: string | null;
}

export interface DeliveryDeps {
  fetch?: typeof fetch;
  resolver?: Resolver;
}

/**
 * One attempt, 5 s timeout, and a `webhook_deliveries` row either way (contracts §6). A 2xx is
 * success; a redirect is not followed and counts as a failure. The error text never carries the
 * URL, which may hold a secret in its query string.
 */
export async function deliverWebhook(
  charge: Charge,
  merchant: Merchant,
  mint: string,
  type: WebhookEventType,
  deps: DeliveryDeps = {},
): Promise<DeliveryResult> {
  const db = getDb();
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.chargeId, charge.id));
  const attempt = count + 1;

  let statusCode: number | null = null;
  let error: string | null = null;
  try {
    if (!charge.webhookUrl) throw new Error('The charge has no webhook URL.');
    await assertPublicWebhookUrl(charge.webhookUrl, deps.resolver);
    const rawBody = buildWebhookBody(charge, mint, type);
    const response = await (deps.fetch ?? fetch)(charge.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'BujiusCheckout-Signature': signWebhook(
          merchant.webhookSecret,
          rawBody,
          Math.floor(Date.now() / 1000),
        ),
      },
      body: rawBody,
      redirect: 'manual',
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    statusCode = response.status;
    await response.body?.cancel();
    if (statusCode < 200 || statusCode > 299) error = `The receiver answered ${statusCode}.`;
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : '';
    error =
      name === 'TimeoutError' || name === 'AbortError'
        ? `The receiver did not answer within ${WEBHOOK_TIMEOUT_MS / 1000} s.`
        : cause instanceof Error && cause.message.startsWith('The webhook URL')
          ? cause.message
          : 'The request to the receiver failed.';
  }

  await db.insert(webhookDeliveries).values({
    id: newId('whd'),
    chargeId: charge.id,
    eventType: type,
    statusCode,
    error,
    attempt,
  });
  return { attempt, statusCode, error };
}
