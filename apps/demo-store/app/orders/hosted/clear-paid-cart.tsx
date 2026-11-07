'use client';

import { useEffect } from 'react';
import { clearCart } from '@/lib/use-cart';

/** Rendered only for a paid charge: a cart left full invites paying for the same items twice. */
export function ClearPaidCart() {
  useEffect(() => {
    clearCart();
  }, []);
  return null;
}
