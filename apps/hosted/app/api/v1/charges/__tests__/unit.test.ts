import { describe, expect, it } from 'vitest';
import { generateApiKey, hashApiKey, readBearerKey } from '../../../../../lib/auth';
import type { Charge } from '../../../../../lib/db/schema';
import { createChargeBody, describeIssue } from '../body';
import { EXPIRY_GRACE_SECONDS, effectiveStatus } from '../serialize';

const valid = { amount: '12.50', orderId: 'order-1' };

describe('createChargeBody', () => {
  it('turns the decimal amount into base units', () => {
    const parsed = createChargeBody.parse(valid);
    expect(parsed.amount).toBe(12_500_000n);
    expect(parsed.expiresInSeconds).toBe(900);
  });

  it.each(['wallet', 'recipients', 'config', 'mint'])('rejects a %s field', (field) => {
    const result = createChargeBody.safeParse({ ...valid, [field]: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) expect(describeIssue(result.error)).toContain(`Unknown field: ${field}`);
  });

  it.each(['0', '0.00', '-1', '1e3', '1.0000001', '', ' 1'])('rejects the amount %j', (amount) => {
    expect(createChargeBody.safeParse({ ...valid, amount }).success).toBe(false);
  });

  it('rejects a numeric amount', () => {
    expect(createChargeBody.safeParse({ ...valid, amount: 12.5 }).success).toBe(false);
  });

  it.each(['http://shop.example', 'javascript:alert(1)', 'data:text/html,x', 'not a url'])(
    'rejects the successUrl %j',
    (successUrl) => {
      expect(createChargeBody.safeParse({ ...valid, successUrl }).success).toBe(false);
      expect(createChargeBody.safeParse({ ...valid, webhookUrl: successUrl }).success).toBe(false);
    },
  );

  it('accepts https URLs', () => {
    const parsed = createChargeBody.parse({
      ...valid,
      successUrl: 'https://shop.example/thanks',
      webhookUrl: 'https://shop.example/hook',
    });
    expect(parsed.successUrl).toBe('https://shop.example/thanks');
  });

  it.each([59, 3601, 90.5])('rejects expiresInSeconds %s', (expiresInSeconds) => {
    expect(createChargeBody.safeParse({ ...valid, expiresInSeconds }).success).toBe(false);
  });
});

describe('API keys', () => {
  it('generates sk_test_ keys that read back from a Bearer header', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^sk_test_[0-9a-f]{64}$/);
    expect(readBearerKey(`Bearer ${key}`)).toBe(key);
  });

  it.each([null, '', 'Bearer', 'Bearer abc', 'Basic sk_test_00', `Bearer sk_live_${'0'.repeat(64)}`])(
    'reads no key from %j',
    (header) => {
      expect(readBearerKey(header)).toBeNull();
    },
  );

  it('stores a stable SHA-256, never the key', () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).not.toContain(key);
  });
});

describe('effectiveStatus', () => {
  const expiresAt = new Date('2026-11-07T12:00:00Z');
  const charge = { status: 'pending', expiresAt } as Charge;
  const at = (seconds: number) => new Date(expiresAt.getTime() + seconds * 1000);

  it('stays pending through the grace window', () => {
    expect(effectiveStatus(charge, at(-1))).toBe('pending');
    expect(effectiveStatus(charge, at(EXPIRY_GRACE_SECONDS))).toBe('pending');
  });

  it('is expired once the grace window has passed', () => {
    expect(effectiveStatus(charge, at(EXPIRY_GRACE_SECONDS + 1))).toBe('expired');
  });

  it('never rewrites a paid charge', () => {
    const paid = { ...charge, status: 'paid' } as Charge;
    expect(effectiveStatus(paid, at(10_000))).toBe('paid');
  });
});
