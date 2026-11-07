export type ChargeStatus = 'pending' | 'paid' | 'paid_late' | 'expired';

/** What `GET /v1/charges/:id/status` answers. */
export interface Charge {
  status: ChargeStatus;
  signature: string | null;
  reference: string;
  /** Base units as a string. */
  amount: string;
  /** ISO 8601. */
  expiresAt: string;
  successUrl: string | null;
}

/**
 * Only an `https:` URL leaves this page. A charge's `successUrl` comes from a merchant's request,
 * and a `javascript:` URL would run on this origin.
 */
export function safeSuccessUrl(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  try {
    // The parsed form: the parser drops tabs and newlines, so the raw text is not what was checked.
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
