// Typed error codes — contracts §3. Never a sentence: the caller maps a code to its copy.
// Each track appends its own codes; existing codes never change meaning.
export const ErrorCode = {
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_EXPIRED: 'ORDER_EXPIRED',
  ORDER_PAID: 'ORDER_PAID',
  ORDER_HELD: 'ORDER_HELD',
  INVALID_ACCOUNT: 'INVALID_ACCOUNT',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  RPC_UNAVAILABLE: 'RPC_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class BujiusCheckoutError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = 'BujiusCheckoutError';
    this.code = code;
  }
}

export function isBujiusCheckoutError(value: unknown): value is BujiusCheckoutError {
  return value instanceof BujiusCheckoutError;
}
