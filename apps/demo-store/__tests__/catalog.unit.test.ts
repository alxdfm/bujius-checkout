import { describe, expect, it } from 'vitest';
import { CATALOG, CATEGORIES, filterCatalog, findProduct, pricedCatalog, priceOrder } from '../lib/catalog';

const skus = (query?: string, category?: string) => filterCatalog(query, category).map(({ sku }) => sku);

describe('the catalog', () => {
  it('prices every product it lists, two decimals, above zero', () => {
    for (const { sku, price } of CATALOG) {
      expect(price).toMatch(/^\d+\.\d{2}$/);
      expect(priceOrder([{ sku, qty: 1 }])).toBeGreaterThan(0n);
    }
  });

  it('gives every category a product', () => {
    for (const category of CATEGORIES) {
      expect(CATALOG.some((product) => product.category === category)).toBe(true);
    }
  });

  it('keeps the prices the tests and past orders rely on', () => {
    expect(findProduct('sticker-pack')?.price).toBe('0.10');
    expect(findProduct('field-notes')?.price).toBe('0.25');
    expect(findProduct('canvas-tote')?.price).toBe('0.50');
  });

  it('hands a client component the picture and the price', () => {
    expect(pricedCatalog()[0]).toEqual({ sku: 'sticker-pack', name: 'Sticker pack', emoji: '🏷️', units: '100000' });
  });

  it('finds nothing for an unknown SKU', () => {
    expect(findProduct('nope')).toBeUndefined();
  });
});

describe('filterCatalog', () => {
  it('lists everything with no filter', () => {
    expect(skus()).toHaveLength(CATALOG.length);
    expect(skus('   ')).toHaveLength(CATALOG.length);
  });

  it('searches the name, ignoring case', () => {
    expect(skus('TOTE')).toEqual(['canvas-tote']);
  });

  it('searches the description and the category', () => {
    expect(skus('notebook')).toEqual(['field-notes']);
    expect(skus('bags')).toEqual(['canvas-tote', 'laptop-sleeve']);
  });

  it('needs every word', () => {
    expect(skus('canvas bag')).toEqual(['canvas-tote']);
    expect(skus('canvas notebook')).toEqual([]);
  });

  it('filters by category, and combines it with a search', () => {
    expect(skus(undefined, 'Home')).toEqual(['coffee-mug', 'water-bottle']);
    expect(skus('steel', 'Home')).toEqual(['water-bottle']);
    expect(skus('steel', 'Desk')).toEqual([]);
  });

  it('treats an unknown category as no filter', () => {
    expect(skus(undefined, 'Nope')).toHaveLength(CATALOG.length);
  });

  it('treats a search as text, not a pattern', () => {
    expect(skus('.*')).toEqual([]);
  });
});
