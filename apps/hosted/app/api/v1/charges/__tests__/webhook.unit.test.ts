import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Charge } from '../../../../../lib/db/schema';
import {
  assertPublicWebhookUrl,
  buildWebhookBody,
  eventId,
  eventTypeFor,
  isInternalAddress,
  signWebhook,
} from '../../../../../lib/webhook';

describe('signWebhook', () => {
  it('is t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>', () => {
    const body = '{"id":"evt_1"}';
    const expected = createHmac('sha256', 'whsec_x').update(`1700000000.${body}`).digest('hex');
    expect(signWebhook('whsec_x', body, 1_700_000_000)).toBe(`t=1700000000,v1=${expected}`);
  });

  it('changes with the body and with the secret', () => {
    const base = signWebhook('whsec_x', 'a', 1);
    expect(signWebhook('whsec_x', 'b', 1)).not.toBe(base);
    expect(signWebhook('whsec_y', 'a', 1)).not.toBe(base);
  });
});

describe('the event', () => {
  const charge = {
    id: 'ch_1',
    orderId: 'order-1',
    reference: 'Ref1111111111111111111111111111111111111111',
    amount: '12500000',
    signature: 'sig',
    paidAt: new Date('2026-11-07T12:00:00Z'),
  } as Charge;

  it('keeps one id per charge and type, so a redelivery can be dropped', () => {
    expect(eventId('ch_1', 'charge.paid')).toBe(eventId('ch_1', 'charge.paid'));
    expect(eventId('ch_1', 'charge.paid')).not.toBe(eventId('ch_1', 'charge.paid_late'));
    expect(eventId('ch_1', 'charge.paid')).toMatch(/^evt_[0-9a-f]{24}$/);
  });

  it('carries the amount as base units and the dates as ISO 8601', () => {
    const event = JSON.parse(buildWebhookBody(charge, 'MintMint', 'charge.paid'));
    expect(event.type).toBe('charge.paid');
    expect(event.data).toEqual({
      chargeId: 'ch_1',
      orderId: 'order-1',
      reference: charge.reference,
      amount: '12500000',
      mint: 'MintMint',
      signature: 'sig',
      paidAt: '2026-11-07T12:00:00.000Z',
    });
  });

  it('exists only for a paid charge', () => {
    expect(eventTypeFor('paid')).toBe('charge.paid');
    expect(eventTypeFor('paid_late')).toBe('charge.paid_late');
    expect(eventTypeFor('pending')).toBeNull();
    expect(eventTypeFor('expired')).toBeNull();
  });
});

describe('isInternalAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1',
    '[::1]', 'not-an-ip',
  ])('blocks %s', (address) => {
    expect(isInternalAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111'])(
    'allows %s',
    (address) => {
      expect(isInternalAddress(address)).toBe(false);
    },
  );
});

describe('assertPublicWebhookUrl', () => {
  const resolvesTo = (...addresses: string[]) => async () => addresses.map((address) => ({ address }));

  it('accepts a public https host', async () => {
    await expect(assertPublicWebhookUrl('https://shop.example/hook', resolvesTo('8.8.8.8'))).resolves.toBeUndefined();
  });

  it.each([
    'http://shop.example/hook',
    'https://localhost/hook',
    'https://api.localhost/hook',
    'https://db.internal/hook',
    'https://printer.local/hook',
    'https://127.0.0.1/hook',
    'https://2130706433/hook',
    'https://[::1]/hook',
    'https://169.254.169.254/latest/meta-data',
  ])('refuses %s', async (url) => {
    await expect(assertPublicWebhookUrl(url, resolvesTo('8.8.8.8'))).rejects.toThrow();
  });

  it('refuses a name that resolves to an internal address, even among public ones', async () => {
    await expect(
      assertPublicWebhookUrl('https://evil.example/hook', resolvesTo('8.8.8.8', '10.0.0.5')),
    ).rejects.toThrow('internal host');
  });
});
