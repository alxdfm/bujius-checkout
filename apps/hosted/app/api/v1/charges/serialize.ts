import { paymentUrl } from '@bujius/checkout-sdk';
import type { Charge, ChargeStatus } from '@/lib/db/schema';

/** `pending` lasts this long after `expires_at`, so a payment signed near the end still lands. */
export const EXPIRY_GRACE_SECONDS = 90;

/** The status a reader sees: `pending` past `expires_at` + grace is `expired` (computed). */
export function effectiveStatus(charge: Charge, now: Date = new Date()): ChargeStatus {
  if (charge.status !== 'pending') return charge.status;
  const limit = charge.expiresAt.getTime() + EXPIRY_GRACE_SECONDS * 1000;
  return now.getTime() > limit ? 'expired' : 'pending';
}

export function baseUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL;
  return (configured || new URL(request.url).origin).replace(/\/$/, '');
}

/** Contracts §6 + the A/B agreement: `amount` is base units as a string, `expiresAt` ISO 8601. */
export function chargeJson(charge: Charge, mint: string, origin: string) {
  return {
    id: charge.id,
    reference: charge.reference,
    amount: charge.amount,
    mint,
    status: effectiveStatus(charge),
    checkoutUrl: `${origin}/c/${charge.id}`,
    paymentUrl: paymentUrl(`${origin}/pay/${charge.reference}`),
    expiresAt: charge.expiresAt.toISOString(),
  };
}
