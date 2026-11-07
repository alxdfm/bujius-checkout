'use client';

import Link from 'next/link';
import { useCart } from '@/lib/use-cart';

export function CartLink() {
  const count = useCart().reduce((total, line) => total + line.qty, 0);
  return (
    <Link href="/cart" className="underline">
      Cart{count > 0 ? ` (${count})` : ''}
    </Link>
  );
}
