import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/webhooks/bujius-checkout/route';
import { isValidWebhookSignature, WEBHOOK_TOLERANCE_SECONDS } from '../lib/webhook-signature';

const SECRET = 'a-webhook-secret';
const NOW = 1_900_000_000;
const EVENT = {
  id: 'evt_1',
  type: 'charge.paid',
  createdAt: '2026-11-07T20:00:00.000Z',
  data: {
    chargeId: 'ch_1',
    orderId: 'ord_1',
    reference: 'Ref111',
    amount: '12500000',
    mint: 'Mint111',
    signature: 'Sig111',
    paidAt: '2026-11-07T20:00:00.000Z',
  },
};
const TEXT = JSON.stringify(EVENT);
const bytes = (text: string) => new TextEncoder().encode(text);
const BODY = bytes(TEXT);

/** The header as contracts §6 defines it, written here so the test does not trust the receiver's code. */
const webhookSignatureHeader = (text: string, secret: string, nowSeconds: number) =>
  `t=${nowSeconds},v1=${createHmac('sha256', secret).update(`${nowSeconds}.${text}`).digest('hex')}`;

describe('isValidWebhookSignature', () => {
  it('accepts the signature of its body', () => {
    expect(isValidWebhookSignature(webhookSignatureHeader(TEXT, SECRET, NOW), BODY, SECRET, NOW)).toBe(true);
  });

  it('refuses a changed body', () => {
    const header = webhookSignatureHeader(TEXT, SECRET, NOW);
    expect(isValidWebhookSignature(header, bytes(`${TEXT} `), SECRET, NOW)).toBe(false);
  });

  it('refuses another secret', () => {
    const header = webhookSignatureHeader(TEXT, 'another-secret', NOW);
    expect(isValidWebhookSignature(header, BODY, SECRET, NOW)).toBe(false);
  });

  it('refuses a timestamp moved to fit the window', () => {
    const header = webhookSignatureHeader(TEXT, SECRET, NOW - 1000).replace(`t=${NOW - 1000}`, `t=${NOW}`);
    expect(isValidWebhookSignature(header, BODY, SECRET, NOW)).toBe(false);
  });

  it.each([
    [0, true],
    [WEBHOOK_TOLERANCE_SECONDS, true],
    [-WEBHOOK_TOLERANCE_SECONDS, true],
    [WEBHOOK_TOLERANCE_SECONDS + 1, false],
    [-WEBHOOK_TOLERANCE_SECONDS - 1, false],
  ])('a timestamp %i seconds from now: %s', (offset, valid) => {
    const header = webhookSignatureHeader(TEXT, SECRET, NOW + offset);
    expect(isValidWebhookSignature(header, BODY, SECRET, NOW)).toBe(valid);
  });

  const good = webhookSignatureHeader(TEXT, SECRET, NOW);
  const hex = good.slice(good.indexOf('v1=') + 3);
  it.each([
    ['no header', null],
    ['an empty header', ''],
    ['no timestamp', `v1=${hex}`],
    ['no signature', `t=${NOW}`],
    ['swapped parts', `v1=${hex},t=${NOW}`],
    ['a repeated part', `t=${NOW},t=${NOW},v1=${hex}`],
    ['a short signature', `t=${NOW},v1=${hex.slice(2)}`],
    ['uppercase hex', `t=${NOW},v1=${hex.toUpperCase()}`],
    ['a timestamp that is not a number', `t=now,v1=${hex}`],
    ['spaces', `t=${NOW}, v1=${hex}`],
  ])('refuses %s', (_name, header) => {
    expect(isValidWebhookSignature(header, BODY, SECRET, NOW)).toBe(false);
  });
});

describe('POST /api/webhooks/bujius-checkout', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const send = (body: string, header?: string) =>
    POST(
      new Request('https://store.example/api/webhooks/bujius-checkout', {
        method: 'POST',
        body,
        headers: header === undefined ? {} : { 'BujiusCheckout-Signature': header },
      }),
    );
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  it('answers 200 to a signed event and logs it without the secret', async () => {
    vi.stubEnv('HOSTED_WEBHOOK_SECRET', SECRET);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const response = await send(TEXT, webhookSignatureHeader(TEXT, SECRET, nowSeconds()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[1]).toEqual(EVENT);
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET);
  });

  it('answers 401 to a missing or wrong signature and logs nothing', async () => {
    vi.stubEnv('HOSTED_WEBHOOK_SECRET', SECRET);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect((await send(TEXT)).status).toBe(401);
    expect((await send(TEXT, webhookSignatureHeader(TEXT, 'another', nowSeconds()))).status).toBe(401);
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    'not json',
    'null',
    '12',
    '[]',
    '{}',
    '{"id":"evt_1"}',
    '{"type":"charge.paid"}',
    '{"id":1,"type":"charge.paid"}',
  ])('answers 400 to the signed body %j and logs nothing', async (text) => {
    vi.stubEnv('HOSTED_WEBHOOK_SECRET', SECRET);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect((await send(text, webhookSignatureHeader(text, SECRET, nowSeconds()))).status).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });

  it('answers 500 with no secret configured, rather than accept anything', async () => {
    vi.stubEnv('HOSTED_WEBHOOK_SECRET', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await send(TEXT, webhookSignatureHeader(TEXT, '', nowSeconds()))).status).toBe(500);
  });
});
