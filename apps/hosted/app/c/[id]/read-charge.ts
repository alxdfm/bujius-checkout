import type { Charge, ChargeStatus } from './charge';

const STATUSES: readonly ChargeStatus[] = ['pending', 'paid', 'paid_late', 'expired'];
// The route asks the chain while a charge is pending, so it is allowed some time.
const READ_TIMEOUT_MS = 15_000;

/** The path the browser polls, and the one the server reads. */
export const chargeStatusPath = (id: string) => `/v1/charges/${encodeURIComponent(id)}/status`;

/** The route's answer as a `Charge`, or `null`: a page must not show a QR from half an answer. */
export function parseCharge(body: unknown): Charge | null {
  const c = (body ?? {}) as Partial<Charge>;
  const valid =
    STATUSES.includes(c.status as ChargeStatus) &&
    typeof c.reference === 'string' &&
    c.reference !== '' &&
    typeof c.amount === 'string' &&
    /^[1-9]\d*$/.test(c.amount) &&
    typeof c.expiresAt === 'string' &&
    !Number.isNaN(Date.parse(c.expiresAt));
  if (!valid) {
    return null;
  }
  return {
    status: c.status as ChargeStatus,
    signature: typeof c.signature === 'string' ? c.signature : null,
    reference: c.reference as string,
    amount: c.amount as string,
    expiresAt: c.expiresAt as string,
    successUrl: typeof c.successUrl === 'string' ? c.successUrl : null,
  };
}

async function isChargeNotFound(response: Response): Promise<boolean> {
  const body = (await response.json().catch(() => null)) as { error?: { code?: unknown } } | null;
  return body?.error?.code === 'CHARGE_NOT_FOUND';
}

/** The charge, or `null` when it does not exist. Any other failure throws: the page's error screen. */
export async function readCharge(baseUrl: string, id: string): Promise<Charge | null> {
  const response = await fetch(`${baseUrl}${chargeStatusPath(id)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  // Only the route's own answer: a wrong `NEXT_PUBLIC_BASE_URL` also gets a 404, from the platform.
  if (response.status === 404 && (await isChargeNotFound(response))) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Status route answered ${response.status}`);
  }
  const charge = parseCharge(await response.json());
  if (!charge) {
    throw new Error('Status route answered an unknown shape');
  }
  return charge;
}
