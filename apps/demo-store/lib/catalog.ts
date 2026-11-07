import { toBaseUnits } from '@bujius/checkout-sdk';
import { MAX_QTY } from './cart';

export { formatUsdc } from './format-usdc';

const USDC_DECIMALS = 6;
const MAX_LINES = 20;

export interface Product {
  sku: string;
  name: string;
  description: string;
  /** Decimal USDC. The only source of a price: never the request. */
  price: string;
  category: Category;
  /** The product's picture: this store has no image files. */
  emoji: string;
}

export const CATEGORIES = ['Stationery', 'Bags', 'Accessories', 'Home', 'Desk'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATALOG: readonly Product[] = [
  { sku: 'sticker-pack', name: 'Sticker pack', description: 'Five die-cut stickers.', price: '0.10', category: 'Stationery', emoji: '🏷️' },
  { sku: 'field-notes', name: 'Field notes', description: 'A pocket notebook, 48 pages.', price: '0.25', category: 'Stationery', emoji: '📓' },
  { sku: 'gel-pen-set', name: 'Gel pen set', description: 'Three fine gel pens in black ink.', price: '0.20', category: 'Stationery', emoji: '🖊️' },
  { sku: 'canvas-tote', name: 'Canvas tote', description: 'A heavy cotton tote bag.', price: '0.50', category: 'Bags', emoji: '👜' },
  { sku: 'laptop-sleeve', name: 'Laptop sleeve', description: 'A padded felt sleeve for a 14-inch laptop.', price: '0.90', category: 'Bags', emoji: '💼' },
  { sku: 'enamel-pin', name: 'Enamel pin', description: 'A small hard-enamel pin with a butterfly clasp.', price: '0.15', category: 'Accessories', emoji: '📍' },
  { sku: 'wool-beanie', name: 'Wool beanie', description: 'A ribbed merino beanie, one size.', price: '0.60', category: 'Accessories', emoji: '🧢' },
  { sku: 'coffee-mug', name: 'Coffee mug', description: 'A 350 ml stoneware mug.', price: '0.40', category: 'Home', emoji: '☕' },
  { sku: 'water-bottle', name: 'Water bottle', description: 'A 750 ml insulated steel bottle.', price: '0.65', category: 'Home', emoji: '🧴' },
  { sku: 'desk-mat', name: 'Desk mat', description: 'A large felt mat for keyboard and mouse.', price: '0.75', category: 'Desk', emoji: '🖱️' },
  { sku: 'cable-organizer', name: 'Cable organizer', description: 'A weighted clip for five cables.', price: '0.30', category: 'Desk', emoji: '🔌' },
  { sku: 'phone-stand', name: 'Phone stand', description: 'A folding aluminium stand.', price: '0.35', category: 'Desk', emoji: '📱' },
];

export const findProduct = (sku: string) => CATALOG.find((product) => product.sku === sku);

/** A URL's search and category as a list. An unknown category is no filter, not an empty page. */
export function filterCatalog(query: string | undefined, category: string | undefined): readonly Product[] {
  const words = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const inCategory = CATEGORIES.some((known) => known === category);
  return CATALOG.filter((product) => {
    const text = `${product.name} ${product.description} ${product.category}`.toLowerCase();
    return (!inCategory || product.category === category) && words.every((word) => text.includes(word));
  });
}

const PRICES = new Map(CATALOG.map((p) => [p.sku, toBaseUnits(p.price, USDC_DECIMALS)]));

/** The order's amount in base units, priced from the catalog, or `null` if the items are invalid. */
export function priceOrder(items: unknown): bigint | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) {
    return null;
  }
  let total = 0n;
  for (const item of items as unknown[]) {
    const { sku, qty } = (item ?? {}) as { sku?: unknown; qty?: unknown };
    const price = typeof sku === 'string' ? PRICES.get(sku) : undefined;
    if (price === undefined || !Number.isInteger(qty) || (qty as number) < 1 || (qty as number) > MAX_QTY) {
      return null;
    }
    total += price * BigInt(qty as number);
  }
  return total;
}

/** Each product with its price in base units, as a string: what a client component may hold. */
export const pricedCatalog = () =>
  CATALOG.map(({ sku, name, emoji }) => ({ sku, name, emoji, units: PRICES.get(sku)!.toString() }));
