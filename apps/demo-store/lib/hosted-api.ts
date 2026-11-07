export interface HostedEnv {
  apiUrl: string;
  apiKey: string;
}

export interface NewHostedCharge {
  /** Decimal USDC: "12.50". */
  amount: string;
  orderId: string;
  webhookUrl: string;
  successUrl: string;
}

export type HostedChargeStatus = 'pending' | 'paid' | 'paid_late' | 'expired';

export interface HostedDelivery {
  /** `null` when no delivery got an answer. */
  statusCode: number | null;
  /** ISO 8601; `null` until the first delivery. */
  sentAt: string | null;
}

export interface HostedCharge {
  status: HostedChargeStatus;
  orderId: string;
  /** Base units. */
  amount: bigint;
  signature: string | null;
  checkoutUrl: string;
  delivery: HostedDelivery;
}

const HOSTED_STATUSES: readonly HostedChargeStatus[] = ['pending', 'paid', 'paid_late', 'expired'];
const REQUEST_TIMEOUT_MS = 10_000;

/** Server only: this carries the API key. `null` when the store is not in hosted mode. */
export function readHostedEnv(): HostedEnv | null {
  const apiUrl = process.env.HOSTED_API_URL;
  const apiKey = process.env.HOSTED_API_KEY;
  return apiUrl && apiKey ? { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey } : null;
}

/** A redirect target: nothing but a web page may come out of this answer. */
function readCheckoutUrl(body: unknown): string | null {
  const raw = (body as { checkoutUrl?: unknown } | null)?.checkoutUrl;
  if (typeof raw !== 'string') {
    return null;
  }
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Contracts §6's error envelope, or `null`: a platform error page is not the API speaking. */
async function readApiError(response: Response): Promise<{ code: string; message: string } | null> {
  const body = (await response.json().catch(() => null)) as { error?: { code?: unknown; message?: unknown } } | null;
  const { code, message } = body?.error ?? {};
  return typeof code === 'string' && typeof message === 'string' ? { code, message } : null;
}

/**
 * Contracts §6. The body names no wallet, recipient, config or mint: who gets paid comes from the
 * merchant's on-chain config. An error here never carries the API key.
 */
export async function createHostedCharge(env: HostedEnv, charge: NewHostedCharge): Promise<string> {
  const response = await fetch(`${env.apiUrl}/v1/charges`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(charge),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const apiError = await readApiError(response);
    throw new Error(`Hosted API answered ${response.status}${apiError ? `: ${apiError.message}` : ''}`);
  }
  const checkoutUrl = readCheckoutUrl(await response.json());
  if (!checkoutUrl) {
    throw new Error('Hosted API answered no checkout URL');
  }
  return checkoutUrl;
}

/** The answer's fields this store shows, or `null`: a page must not say `Paid` from half an answer. */
export function parseHostedCharge(body: unknown): HostedCharge | null {
  const c = (body ?? {}) as Record<string, unknown>;
  const webhook = (c.webhook ?? {}) as Record<string, unknown>;
  const checkoutUrl = readCheckoutUrl(body);
  const valid =
    HOSTED_STATUSES.includes(c.status as HostedChargeStatus) &&
    typeof c.orderId === 'string' &&
    typeof c.amount === 'string' &&
    /^\d+$/.test(c.amount) &&
    checkoutUrl !== null;
  if (!valid) {
    return null;
  }
  return {
    status: c.status as HostedChargeStatus,
    orderId: c.orderId as string,
    amount: BigInt(c.amount as string),
    signature: typeof c.signature === 'string' ? c.signature : null,
    checkoutUrl,
    delivery: {
      statusCode: typeof webhook.lastStatusCode === 'number' ? webhook.lastStatusCode : null,
      sentAt: typeof webhook.lastSentAt === 'string' ? webhook.lastSentAt : null,
    },
  };
}

/** Contracts §6. `null` when the charge is not this merchant's or does not exist; a failure throws. */
export async function readHostedCharge(env: HostedEnv, id: string): Promise<HostedCharge | null> {
  const response = await fetch(`${env.apiUrl}/v1/charges/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${env.apiKey}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  // Only the API's own answer: a wrong `HOSTED_API_URL` also gets a 404, from the platform.
  if (response.status === 404 && (await readApiError(response))?.code === 'CHARGE_NOT_FOUND') {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Hosted API answered ${response.status}`);
  }
  const charge = parseHostedCharge(await response.json());
  if (!charge) {
    throw new Error('Hosted API answered an unknown shape');
  }
  return charge;
}

/**
 * The last delivery in one line. The hosted service sends the webhook after it answers the page
 * that redirected here, so "none yet" is a normal state and never reads as delivered.
 */
export function describeDelivery({ statusCode, sentAt }: HostedDelivery): { delivered: boolean; text: string } {
  if (statusCode !== null && statusCode >= 200 && statusCode < 300) {
    return { delivered: true, text: `Webhook delivered: the store answered ${statusCode}.` };
  }
  if (statusCode !== null) {
    return { delivered: false, text: `Webhook not delivered: the store answered ${statusCode}.` };
  }
  return {
    delivered: false,
    text: sentAt ? 'Webhook not delivered: the store did not answer.' : 'Webhook not sent yet.',
  };
}
