'use client';

import { addToCart } from '@/lib/cart';
import { saveCart, useCart } from '@/lib/use-cart';

export function AddToCart({ sku, price }: { sku: string; price: string }) {
  const cart = useCart();
  return (
    <button
      type="button"
      onClick={() => saveCart(addToCart(cart, sku))}
      className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-zinc-700"
    >
      Add · {price} USDC
    </button>
  );
}
