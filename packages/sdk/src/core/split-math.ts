import { BujiusCheckoutError, ErrorCode } from '../errors';

/**
 * One rule, three places (contracts §2): share[i] = floor(amount × bps[i] / 10_000);
 * merchant gets the remainder. bigint intermediates cover the u64 × bps product.
 * Bps that are negative, fractional or sum above 10_000 throw `CONFIG_NOT_FOUND`, so
 * merchant + Σ share = amount never holds through a negative merchant amount.
 */
export function computeSplit(
  amount: bigint,
  bps: readonly number[],
): { shares: bigint[]; merchant: bigint } {
  if (amount < 0n) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_AMOUNT);
  }
  const validBps = bps.every((b) => Number.isInteger(b) && b >= 0);
  if (!validBps || bps.reduce((total, b) => total + b, 0) > 10_000) {
    throw new BujiusCheckoutError(ErrorCode.CONFIG_NOT_FOUND);
  }
  const shares = bps.map((b) => (amount * BigInt(b)) / 10_000n);
  let sum = 0n;
  for (const share of shares) {
    sum += share;
  }
  return { shares, merchant: amount - sum };
}
