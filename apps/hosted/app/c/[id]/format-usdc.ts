const UNITS_PER_USDC = 1_000_000n;

/** A base-unit amount for a screen, at least two decimals: "12.50". */
export function formatUsdc(amount: bigint): string {
  const whole = amount / UNITS_PER_USDC;
  const fraction = (amount % UNITS_PER_USDC).toString().padStart(6, '0').replace(/0+$/, '');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}
