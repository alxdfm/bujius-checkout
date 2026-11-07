import Link from 'next/link';
import { CATEGORIES, filterCatalog } from '@/lib/catalog';
import { ProductCard } from './product-card';

// Read per request: the search and the category live in the URL.
export const dynamic = 'force-dynamic';

const first = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; category?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = first(params.q)?.trim();
  // An unknown category is no filter, so the heading must not name it.
  const category = CATEGORIES.find((known) => known === first(params.category));
  const products = filterCatalog(query, category);
  const filtered = Boolean(query || category);

  return (
    <>
      {!filtered && (
        <section className="rounded-md bg-brand-800 px-4 py-3 text-white">
          <h1 className="text-lg font-semibold">Everyday goods, one transaction</h1>
          <p className="text-xs text-brand-100">
            Every purchase pays the merchant and its partners at once, with the percentages read from an on-chain
            config.
          </p>
        </section>
      )}
      {filtered && (
        <h1 className="text-lg font-semibold">
          {products.length} {products.length === 1 ? 'result' : 'results'}
          {query ? ` for “${query}”` : ''}
          {category ? ` in ${category}` : ''}
        </h1>
      )}
      {products.length === 0 ? (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-600">We found nothing for this search. Try another word.</p>
          <Link href="/" className="mt-3 inline-block text-sm text-brand-800 underline">
            See all products
          </Link>
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {products.map((product) => (
            <ProductCard key={product.sku} product={product} />
          ))}
        </ul>
      )}
    </>
  );
}
