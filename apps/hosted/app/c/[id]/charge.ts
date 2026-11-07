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
 * Where a paid charge sends its payer. Only an `https:` URL leaves this page: a charge's
 * `successUrl` comes from a merchant's request, and a `javascript:` URL would run on this origin.
 * It carries `chargeId` because the merchant writes this URL before the charge has an id.
 */
export function successRedirectUrl(raw: string | null, chargeId: string): string | null {
  if (!raw) {
    return null;
  }
  try {
    // The parsed form: the parser drops tabs and newlines, so the raw text is not what was checked.
    const url = new URL(raw);
    if (url.protocol !== 'https:') {
      return null;
    }
    // Appended as text: going through `searchParams` rewrites the merchant's query, which they may have signed.
    const param = `chargeId=${encodeURIComponent(chargeId)}`;
    url.search = url.search ? `${url.search}&${param}` : `?${param}`;
    return url.href;
  } catch {
    return null;
  }
}
