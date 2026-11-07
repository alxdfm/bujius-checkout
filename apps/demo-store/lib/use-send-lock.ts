'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { parseSentAt } from './send-lock';

const CHANGED = 'demo-store-send-changed';
const keyOf = (orderId: string) => `demo-store-sent:${orderId}`;

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

function readSentAt(orderId: string): number | null {
  try {
    return parseSentAt(window.localStorage.getItem(keyOf(orderId))) ?? inMemory.get(orderId) ?? null;
  } catch {
    return inMemory.get(orderId) ?? null;
  }
}

function markSent(orderId: string) {
  const now = Date.now();
  inMemory.set(orderId, now);
  try {
    window.localStorage.setItem(keyOf(orderId), String(now));
  } catch {
    // `inMemory` already holds it.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * When the wallet last sent this order, surviving a reload and shared between tabs. `undefined`
 * until hydration: only the browser knows, so nothing payable renders before that.
 */
export function useSendLock(orderId: string): { sentAt: number | null | undefined; markSent: () => void } {
  const sentAt = useSyncExternalStore<number | null | undefined>(
    subscribe,
    () => readSentAt(orderId),
    () => undefined,
  );
  return { sentAt, markSent: useCallback(() => markSent(orderId), [orderId]) };
}
