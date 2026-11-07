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
}

export const CATALOG: readonly Product[] = [
  {
    sku: 'sticker-pack',
    name: 'Sticker pack',
    description: 'Five die-cut stickers.',
    price: '0.10',
  },
  { sku: 'field-notes', name: 'Field notes', description: 'A pocket notebook, 48 pages.', price: '0.25' },
  { sku: 'canvas-tote', name: 'Canvas tote', description: 'A heavy cotton tote bag.', price: '0.50' },
];

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
  CATALOG.map(({ sku, name }) => ({ sku, name, units: PRICES.get(sku)!.toString() }));
