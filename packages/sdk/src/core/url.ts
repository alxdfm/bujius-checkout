import { encodeURL } from '@solana/pay';

/**
 * Builds a Solana Pay transaction-request URL (`solana:…`) from the handler's HTTPS URL.
 */
export function paymentUrl(handlerHttpsUrl: string): string {
  return encodeURL({ link: new URL(handlerHttpsUrl) }).toString();
}
