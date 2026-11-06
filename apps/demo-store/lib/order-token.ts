import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ORDER_TTL_SECONDS = 15 * 60;

/** Contracts §4: the order lives in this token, never in a database. */
export interface OrderPayload {
  v: 1;
  /** Order id. */
  o: string;
  /** Amount in base units, as a string. */
  a: string;
  /** The reference, base58. */
  r: string;
  /** Expiry, unix seconds. */
  e: number;
}

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest().subarray(0, 16);

export const newOrderId = () => `ord_${randomBytes(6).toString('hex')}`;

export function createOrderToken(payload: OrderPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded, secret).toString('base64url')}`;
}

function isOrderPayload(value: unknown): value is OrderPayload {
  const p = value as Partial<OrderPayload> | null;
  return (
    p?.v === 1 &&
    typeof p.o === 'string' &&
    typeof p.a === 'string' &&
    /^[1-9]\d*$/.test(p.a) &&
    typeof p.r === 'string' &&
    Number.isInteger(p.e)
  );
}

/** The payload of a token this store signed, or `null`. Expiry is the caller's check. */
export function readOrderToken(token: string, secret: string): OrderPayload | null {
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra !== undefined) {
    return null;
  }
  const expected = sign(encoded, secret);
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    return isOrderPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

export const isExpired = (payload: OrderPayload, nowSeconds: number) => nowSeconds >= payload.e;
