'use client';

import { openCheckout } from '@bujius/checkout-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MAX_QTY, setQty } from '@/lib/cart';
import { formatUsdc } from '@/lib/format-usdc';
import { saveCart, useCart } from '@/lib/use-cart';

interface PricedProduct {
  sku: string;
  name: string;
  emoji: string;
  /** Base units, as a string. */
  units: string;
}

interface OrderAnswer {
  token?: string;
  checkoutUrl?: string;
  error?: string;
}

const ORDER_FAILED = 'We could not create this order. Try again.';
const STEP = 'h-7 w-7 rounded-md border border-zinc-300 hover:bg-zinc-100 disabled:opacity-40';

export function CartView({ products, hostedEnabled }: { products: PricedProduct[]; hostedEnabled: boolean }) {
  const router = useRouter();
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The hosted checkout is a full navigation: Back can restore this page as it was, still locked.
  useEffect(() => {
    const unlock = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setBusy(false);
      }
    };
    window.addEventListener('pageshow', unlock);
    return () => window.removeEventListener('pageshow', unlock);
  }, []);

  const bySku = new Map(products.map((product) => [product.sku, product]));
  const lines = cart.filter((line) => bySku.has(line.sku));
  // This total is for the screen: the order is priced again on the server.
  const total = lines.reduce((sum, line) => sum + BigInt(bySku.get(line.sku)!.units) * BigInt(line.qty), 0n);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);

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

  /** Sends the cart to a route. `onCreated` moves the payer on, so the buttons stay locked after it. */
  async function createOrder(route: string, onCreated: (body: OrderAnswer) => boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lines }),
      });
      // A platform error page is not JSON: only the route's own sentence reaches the payer.
      const body = (await response.json().catch(() => null)) as OrderAnswer | null;
      if (response.ok && body && onCreated(body)) {
        return;
      }
      setError(body?.error ?? ORDER_FAILED);
    } catch {
      setError(ORDER_FAILED);
    }
    setBusy(false);
  }

  const checkout = () =>
    createOrder('/api/orders', ({ token }) => {
      if (token) {
        router.push(`/checkout/${token}`);
      }
      return Boolean(token);
    });

  const payHosted = () =>
    createOrder('/api/hosted-charges', ({ checkoutUrl }) => {
      if (checkoutUrl) {
        openCheckout(checkoutUrl);
      }
      return Boolean(checkoutUrl);
    });

  return (
    <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {lines.map(({ sku, qty }) => {
          const product = bySku.get(sku)!;
          return (
            <li key={sku} className="flex items-center gap-4 p-4">
              <Link
                href={`/products/${sku}`}
                aria-hidden="true"
                tabIndex={-1}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-canvas text-3xl"
              >
                {product.emoji}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/products/${sku}`} className="font-medium hover:underline">
                  {product.name}
                </Link>
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
      <aside aria-label="Order summary" className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="font-medium">
          Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'}): {formatUsdc(total)} USDC
        </p>
        <button
          type="button"
          onClick={checkout}
          disabled={busy}
          className="mt-3 w-full rounded bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? 'Creating order…' : 'Go to checkout'}
        </button>
        {hostedEnabled && (
          <button
            type="button"
            onClick={payHosted}
            disabled={busy}
            className="mt-2 w-full rounded border border-brand-700 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100 disabled:opacity-50"
          >
            Pay through the hosted checkout
          </button>
        )}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </aside>
    </div>
  );
}
