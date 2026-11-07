'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { latestSentAt, parseSentAt } from './send-lock';

const CHANGED = 'hosted-send-changed';
const keyOf = (chargeId: string) => `hosted-sent:${chargeId}`;

// Also in memory: a browser that refuses storage still keeps the lock until a reload.
const inMemory = new Map<string, number>();

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function readSentAt(chargeId: string): number | null {
  const remembered = inMemory.get(chargeId) ?? null;
  try {
    return latestSentAt(parseSentAt(window.localStorage.getItem(keyOf(chargeId))), remembered);
  } catch {
    return remembered;
  }
}

function markSent(chargeId: string) {
  const now = Date.now();
  inMemory.set(chargeId, now);
  try {
    window.localStorage.setItem(keyOf(chargeId), String(now));
  } catch {
    // `inMemory` already holds it.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * When the wallet last sent this charge, surviving a reload and shared between tabs. `undefined`
 * until hydration: only the browser knows, so nothing payable renders before that.
 */
export function useSendLock(chargeId: string): { sentAt: number | null | undefined; markSent: () => void } {
  const sentAt = useSyncExternalStore<number | null | undefined>(
    subscribe,
    () => readSentAt(chargeId),
    () => undefined,
  );
  return { sentAt, markSent: useCallback(() => markSent(chargeId), [chargeId]) };
}
