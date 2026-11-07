import { createHmac, timingSafeEqual } from 'node:crypto';

/** Contracts §6: the receiver refuses a `t` more than this far away, in either direction. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

const HEADER = /^t=(\d+),v1=([0-9a-f]{64})$/;

/** Over the bytes as they arrived: parsing and printing the JSON again could change them. */
const signatureOf = (timestamp: string, rawBody: Uint8Array, secret: string) =>
  createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();

/** Whether this body came from the hosted service, signed within the time window. */
export function isValidWebhookSignature(
  header: string | null,
  rawBody: Uint8Array,
  secret: string,
  nowSeconds: number,
): boolean {
  const match = header ? HEADER.exec(header) : null;
  if (!match) {
    return false;
  }
  const [, timestamp = '', received = ''] = match;
  if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }
  return timingSafeEqual(signatureOf(timestamp, rawBody, secret), Buffer.from(received, 'hex'));
}
