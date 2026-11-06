import { BujiusCheckoutError, ErrorCode } from '../errors';

/**
 * Parses a decimal string into base units. Rejects negatives, exponents, empty
 * strings, and more fractional digits than `decimals`.
 */
export function toBaseUnits(decimal: string, decimals: number): bigint {
  if (typeof decimal !== 'string' || decimal.length === 0) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_AMOUNT);
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_AMOUNT);
  }
  // No sign, exponent, whitespace, or non-decimal characters.
  if (!/^\d+(\.\d+)?$/.test(decimal)) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_AMOUNT);
  }

  const [wholePart, fractionPart = ''] = decimal.split('.');
  if (fractionPart.length > decimals) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_AMOUNT);
  }

  return BigInt(`${wholePart}${fractionPart.padEnd(decimals, '0')}`);
}

/** Formats base units as a decimal string; never uses scientific notation. */
export function fromBaseUnits(amount: bigint, decimals: number): string {
  if (typeof amount !== 'bigint' || amount < 0n) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_AMOUNT);
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_AMOUNT);
  }

  const raw = amount.toString();
  if (decimals === 0) {
    return raw;
  }

  const padded = raw.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals);
  const trimmedFraction = fraction.replace(/0+$/, '');
  return trimmedFraction.length === 0 ? whole : `${whole}.${trimmedFraction}`;
}
