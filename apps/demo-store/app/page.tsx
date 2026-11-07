import { CATALOG } from '@/lib/catalog';
import { AddToCart } from './add-to-cart';

export default function CatalogPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Demo Store</h1>
      <p className="mt-1 text-sm text-zinc-600">Prices in USDC on Solana devnet.</p>
      <ul className="mt-8 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {CATALOG.map((product) => (
          <li key={product.sku} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-zinc-600">{product.description}</p>
            </div>
            <AddToCart sku={product.sku} price={product.price} />
          </li>
        ))}
      </ul>
    </>
  );
}
