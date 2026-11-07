import Link from 'next/link';
import type { Product } from '@/lib/catalog';
import { AddToCart } from './add-to-cart';
import { UsdcPrice } from './usdc-price';

export function ProductCard({ product }: { product: Product }) {
  return (
    <li className="flex flex-col rounded-md border border-zinc-200 bg-white p-2">
      <Link href={`/products/${product.sku}`} className="group flex flex-1 flex-col">
        <span aria-hidden="true" className="flex aspect-[3/2] items-center justify-center text-5xl">
          {product.emoji}
        </span>
        <span className="mt-1 text-sm font-medium group-hover:underline">{product.name}</span>
        <span className="flex-1 text-xs text-zinc-600">{product.description}</span>
        <UsdcPrice price={product.price} className="mt-1" />
      </Link>
      <div className="mt-2">
        <AddToCart sku={product.sku} />
      </div>
    </li>
  );
}
