import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/hosted-charges/route';
import {
  createHostedCharge,
  describeDelivery,
  parseHostedCharge,
  readHostedCharge,
  readHostedEnv,
} from '../lib/hosted-api';

const API_KEY = 'sk_test_a-secret-key';
const ENV = { apiUrl: 'https://pay.example', apiKey: API_KEY };
const CHARGE = {
  amount: '0.10',
  orderId: 'ord_1',
  webhookUrl: 'https://store.example/api/webhooks/bujius-checkout',
  successUrl: 'https://store.example/orders/hosted',
};
const CREATED = {
  id: 'ch_1',
  reference: 'Ref111',
  amount: '100000',
  mint: 'Mint111',
  status: 'pending',
  checkoutUrl: 'https://pay.example/c/ch_1',
  paymentUrl: 'solana:https://pay.example/pay/Ref111',
  expiresAt: '2026-11-07T20:00:00.000Z',
};

const stubFetch = (status: number, body: unknown) => {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('readHostedEnv', () => {
  it('needs both the URL and the key', () => {
    vi.stubEnv('HOSTED_API_URL', 'https://pay.example');
    vi.stubEnv('HOSTED_API_KEY', '');
    expect(readHostedEnv()).toBeNull();
    vi.stubEnv('HOSTED_API_KEY', API_KEY);
    expect(readHostedEnv()).toEqual(ENV);
  });

  it('drops a trailing slash', () => {
    vi.stubEnv('HOSTED_API_URL', 'https://pay.example/');
    vi.stubEnv('HOSTED_API_KEY', API_KEY);
    expect(readHostedEnv()?.apiUrl).toBe('https://pay.example');
  });
});

describe('createHostedCharge', () => {
  it('posts with the key and answers the checkout URL', async () => {
    const fetchMock = stubFetch(201, CREATED);

    await expect(createHostedCharge(ENV, CHARGE)).resolves.toBe(CREATED.checkoutUrl);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://pay.example/v1/charges');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
  });

  it('sends exactly the fields the strict body allows', async () => {
    const fetchMock = stubFetch(201, CREATED);
    await createHostedCharge(ENV, CHARGE);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual(CHARGE);
  });

  it('fails without the key in the error', async () => {
    stubFetch(401, { error: { code: 'UNAUTHORIZED', message: 'Bad key.' } });
    const error: Error = await createHostedCharge(ENV, CHARGE).catch((e: Error) => e) as Error;
    expect(error.message).toBe('Hosted API answered 401: Bad key.');
    expect(error.message).not.toContain(API_KEY);
  });

  it('fails with only the status when the answer is not the API speaking', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!DOCTYPE html>', { status: 502 })));
    await expect(createHostedCharge(ENV, CHARGE)).rejects.toThrow(/^Hosted API answered 502$/);
  });

  it.each([
    ['no checkout URL', { ...CREATED, checkoutUrl: undefined }],
    ['a script', { ...CREATED, checkoutUrl: 'javascript:alert(1)' }],
    ['text that is not a URL', { ...CREATED, checkoutUrl: 'pay here' }],
  ])('refuses an answer with %s', async (_name, body) => {
    stubFetch(201, body);
    await expect(createHostedCharge(ENV, CHARGE)).rejects.toThrow('no checkout URL');
  });
});

describe('reading a hosted charge', () => {
  const READ = {
    ...CREATED,
    status: 'paid',
    orderId: 'ord_1',
    signature: 'Sig111',
    paidAt: '2026-11-07T19:50:00.000Z',
    webhook: { lastStatusCode: 200, lastSentAt: '2026-11-07T19:50:01.000Z' },
  };

  it('asks with the key, encodes the id and answers the charge', async () => {
    const fetchMock = stubFetch(200, READ);

    await expect(readHostedCharge(ENV, 'a/b')).resolves.toEqual({
      status: 'paid',
      orderId: 'ord_1',
      amount: 100000n,
      signature: 'Sig111',
      checkoutUrl: CREATED.checkoutUrl,
      delivery: { statusCode: 200, sentAt: READ.webhook.lastSentAt },
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://pay.example/v1/charges/a%2Fb');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
  });

  it('answers null for a charge that is not this merchant', async () => {
    stubFetch(404, { error: { code: 'CHARGE_NOT_FOUND', message: 'No charge with this id.' } });
    await expect(readHostedCharge(ENV, 'ch_1')).resolves.toBeNull();
  });

  it.each([
    ['a platform page', () => new Response('<!DOCTYPE html>', { status: 404 })],
    ['another code', () => Response.json({ error: { code: 'NO_ROUTE', message: 'No.' } }, { status: 404 })],
  ])('throws on a 404 from %s, so a wrong API URL is not "not found"', async (_name, answer) => {
    vi.stubGlobal('fetch', vi.fn(async () => answer()));
    await expect(readHostedCharge(ENV, 'ch_1')).rejects.toThrow('404');
  });

  it('throws on a failure, without the key, so the page does not call it "not found"', async () => {
    stubFetch(500, { error: { code: 'INTERNAL', message: 'Failed.' } });
    const error = (await readHostedCharge(ENV, 'ch_1').catch((e: Error) => e)) as Error;
    expect(error.message).toBe('Hosted API answered 500');
    expect(error.message).not.toContain(API_KEY);
  });

  it('throws on an answer it cannot read', async () => {
    stubFetch(200, { status: 'paid' });
    await expect(readHostedCharge(ENV, 'ch_1')).rejects.toThrow('unknown shape');
  });

  it.each([
    ['null', null],
    ['an unknown status', { ...READ, status: 'settled' }],
    ['no order id', { ...READ, orderId: undefined }],
    ['a decimal amount', { ...READ, amount: '0.10' }],
    ['a number for an amount', { ...READ, amount: 100000 }],
    ['a script for a checkout URL', { ...READ, checkoutUrl: 'javascript:alert(1)' }],
  ])('refuses %s', (_name, body) => {
    expect(parseHostedCharge(body)).toBeNull();
  });

  it('reads a charge with no delivery yet', () => {
    const { webhook: _webhook, ...noWebhook } = READ;
    expect(parseHostedCharge(noWebhook)?.delivery).toEqual({ statusCode: null, sentAt: null });
  });
});

describe('describeDelivery', () => {
  const SENT_AT = '2026-11-07T19:50:01.000Z';

  it.each([
    [200, true],
    [204, true],
    [299, true],
    [300, false],
    [401, false],
    [500, false],
  ])('a %i answer: delivered is %s', (statusCode, delivered) => {
    const line = describeDelivery({ statusCode, sentAt: SENT_AT });
    expect(line.delivered).toBe(delivered);
    expect(line.text).toContain(String(statusCode));
  });

  it('tells no answer from no delivery, and neither reads as delivered', () => {
    expect(describeDelivery({ statusCode: null, sentAt: SENT_AT })).toEqual({
      delivered: false,
      text: 'Webhook not delivered: the store did not answer.',
    });
    expect(describeDelivery({ statusCode: null, sentAt: null })).toEqual({
      delivered: false,
      text: 'Webhook not sent yet.',
    });
  });
});

describe('POST /api/hosted-charges', () => {
  beforeEach(() => {
    vi.stubEnv('RPC_URL', 'https://rpc.example');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://store.example');
    vi.stubEnv('ORDER_SECRET', 'a-test-secret');
    vi.stubEnv('NEXT_PUBLIC_SPLIT_CONFIG', 'Config111');
    vi.stubEnv('PAY_STRATEGY', 'program');
    vi.stubEnv('HOSTED_API_URL', ENV.apiUrl);
    vi.stubEnv('HOSTED_API_KEY', API_KEY);
  });

  const send = (body: unknown) =>
    POST(
      new Request('https://store.example/api/hosted-charges', {
        method: 'POST',
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );
  const ITEMS = { items: [{ sku: 'sticker-pack', qty: 1 }] };

  it('prices from the catalog and answers the checkout URL', async () => {
    const fetchMock = stubFetch(201, CREATED);

    const response = await send(ITEMS);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ checkoutUrl: CREATED.checkoutUrl });
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<string, string>;
    expect(sent.amount).toBe('0.10');
    expect(sent.orderId).toMatch(/^ord_/);
    expect(sent.webhookUrl).toBe('https://store.example/api/webhooks/bujius-checkout');
    expect(sent.successUrl).toBe('https://store.example/orders/hosted');
  });

  it('ignores an amount or a wallet in the request', async () => {
    const fetchMock = stubFetch(201, CREATED);
    await send({ ...ITEMS, amount: '0.01', wallet: 'Attacker111', recipients: [] });
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<string, unknown>;
    expect(sent.amount).toBe('0.10');
    expect(Object.keys(sent).sort()).toEqual(['amount', 'orderId', 'successUrl', 'webhookUrl']);
  });

  it('needs none of the on-chain mode secrets', async () => {
    for (const name of ['RPC_URL', 'ORDER_SECRET', 'NEXT_PUBLIC_SPLIT_CONFIG', 'PAY_STRATEGY']) {
      vi.stubEnv(name, '');
    }
    stubFetch(201, CREATED);
    expect((await send(ITEMS)).status).toBe(200);
  });

  it('answers its own 503 when the base URL is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', '');
    const fetchMock = stubFetch(201, CREATED);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await send(ITEMS)).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 404 outside hosted mode, without calling the API', async () => {
    vi.stubEnv('HOSTED_API_KEY', '');
    const fetchMock = stubFetch(201, CREATED);
    expect((await send(ITEMS)).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['unreadable JSON', 'not json'],
    ['an item the store does not sell', { items: [{ sku: 'nope', qty: 1 }] }],
    ['no items', {}],
  ])('answers 400 to %s', async (_name, body) => {
    const fetchMock = stubFetch(201, CREATED);
    expect((await send(body)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers a clear 503 when the API fails, and logs no key', async () => {
    stubFetch(500, { error: { code: 'INTERNAL', message: 'Failed.' } });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await send(ITEMS);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'The hosted checkout is not available right now. Try again in a moment.',
    });
    expect(JSON.stringify(logged.mock.calls)).not.toContain(API_KEY);
  });
});
