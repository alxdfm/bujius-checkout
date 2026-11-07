'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MAX_QTY, setQty } from '@/lib/cart';
import { formatUsdc } from '@/lib/format-usdc';
import { saveCart, useCart } from '@/lib/use-cart';

interface PricedProduct {
  sku: string;
  name: string;
  /** Base units, as a string. */
  units: string;
}

const ORDER_FAILED = 'We could not create this order. Try again.';
const STEP = 'h-7 w-7 rounded-md border border-zinc-300 hover:bg-zinc-100 disabled:opacity-40';

export function CartView({ products }: { products: PricedProduct[] }) {
  const router = useRouter();
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bySku = new Map(products.map((product) => [product.sku, product]));
  const lines = cart.filter((line) => bySku.has(line.sku));
  // This total is for the screen: the order is priced again on the server.
  const total = lines.reduce((sum, line) => sum + BigInt(bySku.get(line.sku)!.units) * BigInt(line.qty), 0n);

  if (lines.length === 0) {
    return (
      <>
        <p className="mt-2 text-zinc-600">Your cart is empty.</p>
        <Link href="/" className="mt-6 inline-block text-sm underline">
          Back to the store
        </Link>
      </>
    );
  }

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lines }),
      });
      // A platform error page is not JSON: only the route's own sentence reaches the payer.
      const body = (await response.json().catch(() => null)) as { token?: string; error?: string } | null;
      if (response.ok && body?.token) {
        router.push(`/checkout/${body.token}`);
        return;
      }
      setError(body?.error ?? ORDER_FAILED);
    } catch {
      setError(ORDER_FAILED);
    }
    setBusy(false);
  }

  return (
    <>
      <ul className="mt-8 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {lines.map(({ sku, qty }) => {
          const product = bySku.get(sku)!;
          return (
            <li key={sku} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-zinc-600">{formatUsdc(BigInt(product.units) * BigInt(qty))} USDC</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button type="button" aria-label={`Remove one ${product.name}`} className={STEP} onClick={() => saveCart(setQty(cart, sku, qty - 1))}>
                  −
                </button>
                <span className="w-5 text-center">{qty}</span>
                <button type="button" aria-label={`Add one ${product.name}`} className={STEP} disabled={qty >= MAX_QTY} onClick={() => saveCart(setQty(cart, sku, qty + 1))}>
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex items-center justify-between">
        <p className="font-medium">Total: {formatUsdc(total)} USDC</p>
        <button
          type="button"
          onClick={checkout}
          disabled={busy}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? 'Creating order…' : 'Go to checkout'}
        </button>
      </div>
      {error && <p className="mt-3 text-right text-sm text-red-700">{error}</p>}
    </>
  );
}
