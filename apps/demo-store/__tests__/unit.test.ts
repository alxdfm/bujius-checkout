import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Keypair, PublicKey, type Connection } from '@solana/web3.js';
import type { SplitConfig } from '@bujius/checkout-sdk';
import { CATALOG, formatUsdc, priceOrder } from '../lib/catalog';
import {
  createOrderToken,
  isExpired,
  newOrderId,
  ORDER_TTL_SECONDS,
  readOrderToken,
  type OrderPayload,
} from '../lib/order-token';
import { createOrderResolver } from '../lib/resolve-order';

const SECRET = 'a-test-secret';
const order = (over: Partial<OrderPayload> = {}): OrderPayload => ({
  v: 1,
  o: 'ord_0123456789ab',
  a: '12500000',
  r: Keypair.generate().publicKey.toBase58(),
  e: 1_900_000_000,
  ...over,
});

describe('catalog', () => {
  it('has three products priced in USDC', () => {
    expect(CATALOG).toHaveLength(3);
  });

  it('prices from the catalog, in base units', () => {
    expect(priceOrder([{ sku: 'sticker-pack', qty: 1 }])).toBe(100_000n);
    expect(
      priceOrder([
        { sku: 'field-notes', qty: 2 },
        { sku: 'canvas-tote', qty: 1 },
      ]),
    ).toBe(1_000_000n);
  });

  it('ignores a price in the request', () => {
    expect(priceOrder([{ sku: 'canvas-tote', qty: 1, price: '0.01', amount: 1 }])).toBe(500_000n);
  });

  it.each([
    ['not a list', 'x'],
    ['nothing', undefined],
    ['an empty list', []],
    ['an unknown sku', [{ sku: 'nope', qty: 1 }]],
    ['a sku inherited from an object', [{ sku: 'constructor', qty: 1 }]],
    ['no sku', [{ qty: 1 }]],
    ['a null line', [null]],
    ['no quantity', [{ sku: 'sticker-pack' }]],
    ['a zero quantity', [{ sku: 'sticker-pack', qty: 0 }]],
    ['a negative quantity', [{ sku: 'sticker-pack', qty: -1 }]],
    ['a fractional quantity', [{ sku: 'sticker-pack', qty: 1.5 }]],
    ['a quantity as a string', [{ sku: 'sticker-pack', qty: '1' }]],
    ['too many of one item', [{ sku: 'sticker-pack', qty: 11 }]],
    ['too many lines', Array.from({ length: 21 }, () => ({ sku: 'sticker-pack', qty: 1 }))],
  ])('refuses %s', (_, items) => {
    expect(priceOrder(items)).toBeNull();
  });

  it('formats at least two decimals, with no float', () => {
    expect(formatUsdc(12_500_000n)).toBe('12.50');
    expect(formatUsdc(12_000_000n)).toBe('12.00');
    expect(formatUsdc(100_000n)).toBe('0.10');
    expect(formatUsdc(2_500n)).toBe('0.0025');
    expect(formatUsdc(18_446_744_073_709_551_615n)).toBe('18446744073709.551615');
  });
});

describe('order token', () => {
  it('round-trips, in the format of contracts §4', () => {
    const payload = order();
    const token = createOrderToken(payload, SECRET);
    const [encoded, signature] = token.split('.') as [string, string];

    expect(readOrderToken(token, SECRET)).toEqual(payload);
    expect(JSON.parse(Buffer.from(encoded, 'base64url').toString())).toEqual(payload);
    expect(signature).toBe(
      createHmac('sha256', SECRET).update(encoded).digest().subarray(0, 16).toString('base64url'),
    );
  });

  it('stays under 200 characters, so it rides in the QR', () => {
    const token = createOrderToken(order({ o: newOrderId(), a: '18446744073709551615' }), SECRET);
    expect(token.length).toBeLessThan(200);
  });

  it('refuses a changed amount, a changed signature and another secret', () => {
    const token = createOrderToken(order(), SECRET);
    const [, signature] = token.split('.') as [string, string];
    const forged = Buffer.from(JSON.stringify(order({ a: '1' }))).toString('base64url');
    const flipped = signature.startsWith('A') ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;

    expect(readOrderToken(`${forged}.${signature}`, SECRET)).toBeNull();
    expect(readOrderToken(`${token.split('.')[0]}.${flipped}`, SECRET)).toBeNull();
    expect(readOrderToken(token, 'another-secret')).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['no signature', 'abc'],
    ['an empty signature', 'abc.'],
    ['an extra part', 'a.b.c'],
    ['a short signature', 'abc.AAAA'],
  ])('refuses a malformed token: %s', (_, token) => {
    expect(readOrderToken(token, SECRET)).toBeNull();
  });

  it.each([
    ['another version', { v: 2 }],
    ['an amount that is not base units', { a: '12.50' }],
    ['a zero amount', { a: '0' }],
    ['a negative amount', { a: '-1' }],
    ['an expiry that is not an integer', { e: 'soon' }],
  ])('refuses a signed payload with %s', (_, over) => {
    const token = createOrderToken({ ...order(), ...over } as OrderPayload, SECRET);
    expect(readOrderToken(token, SECRET)).toBeNull();
  });

  it('expires at the expiry second, 15 minutes after creation', () => {
    expect(ORDER_TTL_SECONDS).toBe(900);
    expect(isExpired(order({ e: 100 }), 99)).toBe(false);
    expect(isExpired(order({ e: 100 }), 100)).toBe(true);
  });
});

describe('the handler resolve', () => {
  const config: SplitConfig = {
    address: Keypair.generate().publicKey,
    authority: Keypair.generate().publicKey,
    id: 1,
    mint: Keypair.generate().publicKey,
    recipients: [],
  };

  function resolver(signatures: { signature: string; err: unknown }[] = [], now = 1_000) {
    const loadConfig = vi.fn(async () => config);
    const getSignaturesForAddress = vi.fn(async () => signatures);
    const resolve = createOrderResolver({
      connection: { getSignaturesForAddress } as unknown as Connection,
      orderSecret: SECRET,
      loadConfig,
      nowSeconds: () => now,
    });
    return { resolve, loadConfig, getSignaturesForAddress };
  }

  it('resolves a valid order to its config, amount, reference and message', async () => {
    const payload = order({ e: 2_000 });
    const { resolve } = resolver();

    await expect(resolve(createOrderToken(payload, SECRET))).resolves.toEqual({
      config,
      amount: 12_500_000n,
      reference: new PublicKey(payload.r),
      message: `Order ${payload.o}`,
    });
  });

  it('answers ORDER_NOT_FOUND for a token it did not sign, before asking the chain', async () => {
    const { resolve, getSignaturesForAddress } = resolver();

    await expect(resolve(createOrderToken(order(), 'another-secret'))).resolves.toEqual({
      error: 'ORDER_NOT_FOUND',
    });
    expect(getSignaturesForAddress).not.toHaveBeenCalled();
  });

  it('answers ORDER_EXPIRED before asking the chain', async () => {
    const { resolve, getSignaturesForAddress } = resolver([], 2_000);

    await expect(resolve(createOrderToken(order({ e: 2_000 }), SECRET))).resolves.toEqual({
      error: 'ORDER_EXPIRED',
    });
    expect(getSignaturesForAddress).not.toHaveBeenCalled();
  });

  it('answers ORDER_PAID once a successful payment carries the reference', async () => {
    const { resolve, loadConfig } = resolver([{ signature: 'sig', err: null }]);

    await expect(resolve(createOrderToken(order({ e: 2_000 }), SECRET))).resolves.toEqual({
      error: 'ORDER_PAID',
    });
    expect(loadConfig).not.toHaveBeenCalled();
  });

  it('does not count a failed transaction as a payment', async () => {
    const { resolve } = resolver([{ signature: 'sig', err: { InstructionError: [0, 'x'] } }]);
    const result = await resolve(createOrderToken(order({ e: 2_000 }), SECRET));

    expect(result).toMatchObject({ amount: 12_500_000n });
  });
});
