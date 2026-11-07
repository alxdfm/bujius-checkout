import { describe, expect, it } from 'vitest';
import { safeSuccessUrl } from '../app/c/[id]/charge';
import { formatUsdc } from '../app/c/[id]/format-usdc';
import { isSendInFlight, latestSentAt, parseSentAt, SEND_WINDOW_MS } from '../app/c/[id]/send-lock';

describe('safeSuccessUrl', () => {
  it('keeps an https URL', () => {
    expect(safeSuccessUrl('https://shop.example/thanks?order=1')).toBe('https://shop.example/thanks?order=1');
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
    expect(safeSuccessUrl(raw)).toBeNull();
  });

  it('refuses a charge with none', () => {
    expect(safeSuccessUrl(null)).toBeNull();
  });

  it('returns the checked form, not the raw text', () => {
    expect(safeSuccessUrl('https://shop.example/thanks\n')).toBe('https://shop.example/thanks');
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
