'use client';

import Link from 'next/link';
import { useCart } from '@/lib/use-cart';

export function CartLink() {
  const count = useCart().reduce((total, line) => total + line.qty, 0);
  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
      className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium hover:bg-white/15"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        🛒
      </span>
      Cart
      <span className="min-w-5 rounded-full bg-brand-700 px-1.5 text-center text-xs leading-5">{count}</span>
    </Link>
  );
}
