'use client';

import { useRouter } from 'next/navigation';
import { addToCart } from '@/lib/cart';
import { saveCart, useCart } from '@/lib/use-cart';

const PRIMARY = 'w-full rounded bg-brand-700 px-2 py-1.5 text-sm font-medium text-white hover:bg-brand-600';
const SECONDARY =
  'w-full rounded border border-brand-700 bg-white px-2 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-100';

export function AddToCart({ sku }: { sku: string }) {
  const cart = useCart();
  const inCart = cart.find((line) => line.sku === sku)?.qty ?? 0;
  return (
    <button type="button" onClick={() => saveCart(addToCart(cart, sku))} className={PRIMARY}>
      {inCart > 0 ? `Add another (${inCart} in cart)` : 'Add to cart'}
    </button>
  );
}

export function BuyNow({ sku }: { sku: string }) {
  const router = useRouter();
  const cart = useCart();
  return (
    <button
      type="button"
      onClick={() => {
        // Adds only when absent: going back and buying again should not double the line.
        if (!cart.some((line) => line.sku === sku)) {
          saveCart(addToCart(cart, sku));
        }
        router.push('/cart');
      }}
      className={SECONDARY}
    >
      Buy now
    </button>
  );
}
