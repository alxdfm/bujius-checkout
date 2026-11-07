'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { parseCart, type CartLine } from './cart';

const KEY = 'demo-store-cart';
const CHANGED = 'demo-store-cart-changed';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

export function saveCart(cart: readonly CartLine[]) {
  window.localStorage.setItem(KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event(CHANGED));
}

export const clearCart = () => saveCart([]);

/** The cart lives in this browser: the store has no database. Empty until hydration. */
export function useCart(): CartLine[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(KEY),
    () => null,
  );
  return useMemo(() => parseCart(raw), [raw]);
}
