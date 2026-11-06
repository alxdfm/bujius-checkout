import { describe, expect, it } from 'vitest';
import { BujiusCheckoutError, ErrorCode, isBujiusCheckoutError } from '../src';

// Each track appends its own describe blocks (PLAN.md §4).
describe('errors', () => {
  it('carries the code, never a sentence', () => {
    const error = new BujiusCheckoutError(ErrorCode.ORDER_HELD);
    expect(error.code).toBe('ORDER_HELD');
    expect(error.message).toBe('ORDER_HELD');
    expect(isBujiusCheckoutError(error)).toBe(true);
  });

  it('lists every code of contracts §3', () => {
    expect(Object.keys(ErrorCode).sort()).toEqual([
      'CONFIG_NOT_FOUND',
      'INVALID_ACCOUNT',
      'INVALID_AMOUNT',
      'ORDER_EXPIRED',
      'ORDER_HELD',
      'ORDER_NOT_FOUND',
      'ORDER_PAID',
      'RPC_UNAVAILABLE',
    ]);
  });
});
