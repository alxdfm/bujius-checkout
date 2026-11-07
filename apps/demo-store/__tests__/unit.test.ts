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
import { addToCart, MAX_QTY, parseCart, setQty } from '../lib/cart';
import { EXPIRY_GRACE_SECONDS, readOrderStatus } from '../lib/order-status';
import { isSendInFlight, parseSentAt, SEND_WINDOW_MS } from '../lib/send-lock';

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
  it('has products, each with its own SKU', () => {
    expect(CATALOG.length).toBeGreaterThan(0);
    expect(new Set(CATALOG.map(({ sku }) => sku)).size).toBe(CATALOG.length);
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

describe('formatUsdc on a leg', () => {
  it.each([
    [87_500n, '0.0875'],
    [10_000n, '0.01'],
    [2_500n, '0.0025'],
    [12_500_000n, '12.50'],
    [1n, '0.000001'],
    [0n, '0.00'],
  ])('%s -> %s', (amount, text) => {
    expect(formatUsdc(amount)).toBe(text);
  });
});

describe('cart', () => {
  it('adds, counts up and stops at the limit priceOrder accepts', () => {
    let cart = addToCart([], 'a');
    cart = addToCart(cart, 'a');
    expect(cart).toEqual([{ sku: 'a', qty: 2 }]);
    expect(setQty(cart, 'a', MAX_QTY + 5)).toEqual([{ sku: 'a', qty: MAX_QTY }]);
    expect(priceOrder(setQty(addToCart([], 'sticker-pack'), 'sticker-pack', 99))).toBe(1_000_000n);
  });

  it('removes a line below 1 and leaves the others', () => {
    const cart = addToCart(addToCart([], 'a'), 'b');
    expect(setQty(cart, 'a', 0)).toEqual([{ sku: 'b', qty: 1 }]);
  });

  it.each([
    ['nothing saved', null],
    ['broken JSON', '{'],
    ['not a list', '{"sku":"a"}'],
    ['a null line', '[null]'],
    ['a zero quantity', '[{"sku":"a","qty":0}]'],
    ['too many', '[{"sku":"a","qty":11}]'],
    ['a fractional quantity', '[{"sku":"a","qty":1.5}]'],
    ['a quantity as a string', '[{"sku":"a","qty":"1"}]'],
  ])('reads %s as an empty cart', (_, raw) => {
    expect(parseCart(raw)).toEqual([]);
  });

  it('keeps the first of a repeated line, so a sku is never counted twice', () => {
    expect(parseCart('[{"sku":"a","qty":1},{"sku":"a","qty":9}]')).toEqual([{ sku: 'a', qty: 1 }]);
  });
});

describe('readOrderStatus', () => {
  const merchant = Keypair.generate().publicKey;
  const partner = Keypair.generate().publicKey;
  const platform = Keypair.generate().publicKey;
  const mint = Keypair.generate().publicKey;
  const config: SplitConfig = {
    address: Keypair.generate().publicKey,
    authority: merchant,
    id: 1n,
    mint,
    recipients: [
      { wallet: partner, bps: 1000 },
      { wallet: platform, bps: 250 },
    ],
  } as unknown as SplitConfig;
  const EXPIRES = 1_900_000_000;
  const paying = () => order({ a: '100000', e: EXPIRES });

  const balance = (owner: PublicKey, amount: bigint) => ({
    mint: mint.toBase58(),
    owner: owner.toBase58(),
    uiTokenAmount: { amount: amount.toString() },
  });

  /** A parsed transaction whose legs rose by these amounts. */
  const transaction = (reference: string, rose: [bigint, bigint, bigint], over: object = {}) => ({
    blockTime: EXPIRES - 60,
    transaction: { message: { accountKeys: [{ pubkey: reference }] } },
    meta: {
      err: null,
      preTokenBalances: [],
      postTokenBalances: [balance(merchant, rose[0]), balance(partner, rose[1]), balance(platform, rose[2])],
    },
    ...over,
  });

  function chainWith(signatures: object[] | Error, tx: unknown = null) {
    const connection = {
      getSignaturesForAddress: vi.fn(async () => {
        if (signatures instanceof Error) throw signatures;
        return signatures;
      }),
      getParsedTransaction: vi.fn(async () => tx),
    };
    return {
      connection: connection as unknown as Connection,
      loadConfig: vi.fn(async () => config),
    };
  }
  const SIGNED = [{ signature: 'sig1', err: null }];
  const EXACT: [bigint, bigint, bigint] = [87_500n, 10_000n, 2_500n];

  it('stays pending with no payment before the expiry and through the grace', async () => {
    const chain = chainWith([]);
    for (const now of [EXPIRES - 1, EXPIRES, EXPIRES + EXPIRY_GRACE_SECONDS - 1]) {
      expect(await readOrderStatus(chain, paying(), now)).toEqual({ status: 'pending' });
    }
  });

  it('expires when the grace ends with no payment', async () => {
    expect(await readOrderStatus(chainWith([]), paying(), EXPIRES + EXPIRY_GRACE_SECONDS)).toEqual({ status: 'expired' });
  });

  it('a signature alone is not paid: the amounts decide', async () => {
    const o = paying();
    const result = await readOrderStatus(chainWith(SIGNED, transaction(o.r, [1n, 10_000n, 2_500n])), o, EXPIRES - 60);
    expect(result.status).toBe('invalid');
  });

  it('is paid with the exact legs, recipients first and the merchant last', async () => {
    const o = paying();
    const result = await readOrderStatus(chainWith(SIGNED, transaction(o.r, EXACT)), o, EXPIRES - 60);
    expect(result).toMatchObject({ status: 'paid', signature: 'sig1' });
    const legs = 'legs' in result ? result.legs : [];
    expect(legs.map((l) => l.amount)).toEqual([10_000n, 2_500n, 87_500n]);
    expect(legs[2]!.wallet.equals(merchant)).toBe(true);
  });

  it('is paid_late when the block is past the expiry, even after the grace', async () => {
    const o = paying();
    const tx = transaction(o.r, EXACT, { blockTime: EXPIRES + 30 });
    const result = await readOrderStatus(chainWith(SIGNED, tx), o, EXPIRES + 10_000);
    expect(result.status).toBe('paid_late');
  });

  it('a signature the RPC does not serve yet stays pending, never a final invalid', async () => {
    const result = await readOrderStatus(chainWith(SIGNED, null), paying(), EXPIRES - 60);
    expect(result).toEqual({ status: 'pending' });
  });

  it('a transaction without the reference is invalid', async () => {
    const o = paying();
    const chain = chainWith(SIGNED, transaction(Keypair.generate().publicKey.toBase58(), EXACT));
    expect((await readOrderStatus(chain, o, EXPIRES - 60)).status).toBe('invalid');
  });

  it('lets an RPC failure through, for the route to say the network is busy', async () => {
    await expect(readOrderStatus(chainWith(new Error('429')), paying(), EXPIRES)).rejects.toMatchObject({
      code: 'RPC_UNAVAILABLE',
    });
  });
});

describe('send lock', () => {
  it('holds for the whole window and opens when it ends', () => {
    expect(isSendInFlight(1_000, 1_000)).toBe(true);
    expect(isSendInFlight(1_000, 1_000 + SEND_WINDOW_MS - 1)).toBe(true);
    expect(isSendInFlight(1_000, 1_000 + SEND_WINDOW_MS)).toBe(false);
  });

  it('holds nothing when no payment was sent', () => {
    expect(isSendInFlight(null, 1_000)).toBe(false);
  });

  it('reads a saved time and refuses anything else', () => {
    expect(parseSentAt('1900000000000')).toBe(1_900_000_000_000);
    for (const raw of [null, '', 'abc', '-1', '0', '1.5', '1e400']) {
      expect(parseSentAt(raw)).toBeNull();
    }
  });
});
