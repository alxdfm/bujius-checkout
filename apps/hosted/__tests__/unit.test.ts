import { afterEach, describe, expect, it, vi } from 'vitest';
import { successRedirectUrl } from '../app/c/[id]/charge';
import { formatUsdc } from '../app/c/[id]/format-usdc';
import { chargeStatusPath, parseCharge, readCharge } from '../app/c/[id]/read-charge';
import { isSendInFlight, latestSentAt, parseSentAt, SEND_WINDOW_MS } from '../app/c/[id]/send-lock';

describe('successRedirectUrl', () => {
  it('keeps an https URL and adds the charge id', () => {
    expect(successRedirectUrl('https://shop.example/thanks?order=1', 'ch_1')).toBe(
      'https://shop.example/thanks?order=1&chargeId=ch_1',
    );
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://shop.example/thanks',
    '//shop.example/thanks',
    '/thanks',
    'not a url',
    '',
  ])('refuses %j', (raw) => {
    expect(successRedirectUrl(raw, 'ch_1')).toBeNull();
  });

  it('refuses a charge with none', () => {
    expect(successRedirectUrl(null, 'ch_1')).toBeNull();
  });

  it('returns the checked form, not the raw text', () => {
    expect(successRedirectUrl('https://shop.example/thanks\n', 'ch_1')).toBe(
      'https://shop.example/thanks?chargeId=ch_1',
    );
  });

  it('leaves the merchant query exactly as written', () => {
    expect(successRedirectUrl('https://shop.example/thanks?sig=a%20b&t=1', 'ch_1')).toBe(
      'https://shop.example/thanks?sig=a%20b&t=1&chargeId=ch_1',
    );
  });

  it('keeps a chargeId of the merchant first, and a fragment last', () => {
    expect(successRedirectUrl('https://shop.example/thanks?chargeId=mine#top', 'ch_1')).toBe(
      'https://shop.example/thanks?chargeId=mine&chargeId=ch_1#top',
    );
  });

  it('encodes the charge id', () => {
    expect(successRedirectUrl('https://shop.example/thanks', 'a&b=c')).toBe(
      'https://shop.example/thanks?chargeId=a%26b%3Dc',
    );
  });
});

describe('reading a charge', () => {
  const CHARGE = {
    status: 'pending',
    signature: null,
    reference: 'Ref111',
    amount: '12500000',
    expiresAt: '2026-11-07T20:00:00.000Z',
    successUrl: null,
  };
  const stubFetch = (status: number, body: unknown) => {
    const fetchMock = vi.fn(async (_url: string) => Response.json(body, { status }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('encodes the id in the path', () => {
    expect(chargeStatusPath('a/b')).toBe('/v1/charges/a%2Fb/status');
  });

  it('asks the status route and answers the charge', async () => {
    const fetchMock = stubFetch(200, CHARGE);
    await expect(readCharge('https://pay.example', 'ch_1')).resolves.toEqual(CHARGE);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://pay.example/v1/charges/ch_1/status');
  });

  it('answers null for an unknown charge', async () => {
    stubFetch(404, { error: { code: 'CHARGE_NOT_FOUND', message: 'No charge with this id.' } });
    await expect(readCharge('https://pay.example', 'ch_1')).resolves.toBeNull();
  });

  it.each([
    ['a platform page', () => new Response('<!DOCTYPE html>', { status: 404 })],
    ['another code', () => Response.json({ error: { code: 'NO_ROUTE' } }, { status: 404 })],
  ])('throws on a 404 from %s, so a wrong base URL is not "not found"', async (_name, answer) => {
    vi.stubGlobal('fetch', vi.fn(async () => answer()));
    await expect(readCharge('https://pay.example', 'ch_1')).rejects.toThrow('404');
  });

  it('throws on a failure, so the page does not call it "not found"', async () => {
    stubFetch(500, { error: { code: 'INTERNAL', message: 'Failed.' } });
    await expect(readCharge('https://pay.example', 'ch_1')).rejects.toThrow('500');
  });

  it('throws on an answer it cannot read', async () => {
    stubFetch(200, { status: 'pending' });
    await expect(readCharge('https://pay.example', 'ch_1')).rejects.toThrow('unknown shape');
  });

  it.each([
    ['null', null],
    ['an unknown status', { ...CHARGE, status: 'invalid' }],
    ['no reference', { ...CHARGE, reference: undefined }],
    ['an empty reference', { ...CHARGE, reference: '' }],
    ['a decimal amount', { ...CHARGE, amount: '12.50' }],
    ['a zero amount', { ...CHARGE, amount: '0' }],
    ['a number for an amount', { ...CHARGE, amount: 12500000 }],
    ['an unreadable expiry', { ...CHARGE, expiresAt: 'soon' }],
  ])('refuses %s', (_name, body) => {
    expect(parseCharge(body)).toBeNull();
  });

  it('reads a paid charge with its signature and success URL', () => {
    const paid = { ...CHARGE, status: 'paid', signature: 'Sig111', successUrl: 'https://shop.example/thanks' };
    expect(parseCharge(paid)).toEqual(paid);
  });
});

describe('send lock', () => {
  const sentAt = 1_000_000;

  it('holds inside the window and opens at its end', () => {
    expect(isSendInFlight(sentAt, sentAt)).toBe(true);
    expect(isSendInFlight(sentAt, sentAt + SEND_WINDOW_MS - 1)).toBe(true);
    expect(isSendInFlight(sentAt, sentAt + SEND_WINDOW_MS)).toBe(false);
  });

  it('does not hold with no send', () => {
    expect(isSendInFlight(null, sentAt)).toBe(false);
  });

  it('does not hold for a send in the future', () => {
    expect(isSendInFlight(sentAt + 1, sentAt)).toBe(false);
  });

  it('takes the latest of storage and memory', () => {
    expect(latestSentAt(5, 9)).toBe(9);
    expect(latestSentAt(9, 5)).toBe(9);
    expect(latestSentAt(5, null)).toBe(5);
    expect(latestSentAt(null, 5)).toBe(5);
    expect(latestSentAt(null, null)).toBeNull();
  });

  it.each([null, '', 'abc', '-1', '0', '1.5'])('refuses the stored text %j', (raw) => {
    expect(parseSentAt(raw)).toBeNull();
  });

  it('reads a stored time', () => {
    expect(parseSentAt('1000000')).toBe(1_000_000);
  });
});

describe('formatUsdc', () => {
  it.each([
    [12_500_000n, '12.50'],
    [1_000_000n, '1.00'],
    [0n, '0.00'],
    [125_000n, '0.125'],
  ])('%s is %s', (amount, text) => {
    expect(formatUsdc(amount)).toBe(text);
  });
});
