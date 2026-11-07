import Link from 'next/link';
import { CATEGORIES } from '@/lib/catalog';
import { CartLink } from './cart-link';

/** The search is a plain GET form: it works before hydration, and a result has its own URL. */
export function SiteHeader() {
  return (
    <header>
      <div className="bg-brand-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Link href="/" className="rounded px-1 text-xl font-bold tracking-tight hover:opacity-80">
            Demo Store
          </Link>
          <form action="/" role="search" className="order-last flex w-full min-w-0 md:order-none md:flex-1">
            <label htmlFor="site-search" className="sr-only">
              Search the store
            </label>
            <input
              id="site-search"
              name="q"
              type="search"
              placeholder="Search the store"
              className="min-w-0 flex-1 rounded-l-md bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-brand-600"
            />
            <button
              type="submit"
              className="rounded-r-md bg-brand-700 px-4 text-sm font-medium hover:bg-brand-600"
            >
              Search
            </button>
          </form>
          <div className="ml-auto md:ml-0">
            <CartLink />
          </div>
        </div>
      </div>
      <nav aria-label="Categories" className="bg-brand-800 text-sm text-white">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-1.5 whitespace-nowrap">
          <Link href="/" className="rounded px-2 py-1 hover:bg-white/15">
            All
          </Link>
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/?category=${encodeURIComponent(category)}`}
              className="rounded px-2 py-1 hover:bg-white/15"
            >
              {category}
            </Link>
          ))}
        </div>
      </nav>
      <p className="bg-brand-100 px-4 py-1.5 text-center text-xs text-brand-950">
        A demo store on Solana devnet: test USDC only, and nothing ships.
      </p>
    </header>
  );
}
