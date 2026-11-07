import Link from 'next/link';
import { CATALOG, findProduct } from '@/lib/catalog';
import { AddToCart, BuyNow } from '../../add-to-cart';
import { Notice } from '../../notice';
import { UsdcPrice } from '../../usdc-price';

export const generateStaticParams = () => CATALOG.map(({ sku }) => ({ sku }));

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const product = findProduct(sku);
  if (!product) {
    return <Notice title="Product not found" text="This store does not sell this product." />;
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-xs text-zinc-600">
        <Link href="/" className="hover:underline">
          All
        </Link>
        {' › '}
        <Link href={`/?category=${encodeURIComponent(product.category)}`} className="hover:underline">
          {product.category}
        </Link>
      </nav>
      <div className="mt-3 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_18rem]">
        <div
          aria-hidden="true"
          className="flex aspect-square items-center justify-center rounded-lg border border-zinc-200 bg-white text-8xl"
        >
          {product.emoji}
        </div>
        <section>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <UsdcPrice price={product.price} large className="mt-3 border-b border-zinc-200 pb-3" />
          <h2 className="mt-4 text-sm font-semibold">About this item</h2>
          <p className="mt-1 text-sm text-zinc-700">{product.description}</p>
        </section>
        <aside aria-label="Buy this product" className="h-fit rounded-lg border border-zinc-200 bg-white p-4">
          <UsdcPrice price={product.price} />
          <p className="mt-2 text-xs text-zinc-600">
            Paid in one transaction on Solana devnet, with test USDC. A demo item: nothing ships.
          </p>
          <div className="mt-4 space-y-2">
            <AddToCart sku={product.sku} />
            <BuyNow sku={product.sku} />
          </div>
        </aside>
      </div>
    </>
  );
}
