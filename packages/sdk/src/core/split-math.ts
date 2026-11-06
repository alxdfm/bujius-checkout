/**
 * One rule, three places (contracts §2): share[i] = floor(amount × bps[i] / 10_000);
 * merchant gets the remainder. bigint intermediates cover the u64 × bps product.
 */
export function computeSplit(
  amount: bigint,
  bps: readonly number[],
): { shares: bigint[]; merchant: bigint } {
  const shares = bps.map((b) => (amount * BigInt(b)) / 10_000n);
  let sum = 0n;
  for (const share of shares) {
    sum += share;
  }
  return { shares, merchant: amount - sum };
}
