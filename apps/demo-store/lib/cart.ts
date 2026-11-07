export const MAX_QTY = 10;

export interface CartLine {
  sku: string;
  qty: number;
}

/** The saved cart, keeping only well-formed lines: this text comes from the browser's storage. */
export function parseCart(raw: string | null): CartLine[] {
  let saved: unknown;
  try {
    saved = JSON.parse(raw ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(saved)) {
    return [];
  }
  const lines = new Map<string, CartLine>();
  for (const item of saved as unknown[]) {
    const { sku, qty } = (item ?? {}) as Partial<CartLine>;
    if (typeof sku === 'string' && Number.isInteger(qty) && qty! >= 1 && qty! <= MAX_QTY && !lines.has(sku)) {
      lines.set(sku, { sku, qty: qty! });
    }
  }
  return [...lines.values()];
}

/** Sets one line. Below 1 removes it; above the limit stays at the limit `priceOrder` accepts. */
export function setQty(cart: readonly CartLine[], sku: string, qty: number): CartLine[] {
  if (qty < 1) {
    return cart.filter((line) => line.sku !== sku);
  }
  const capped = Math.min(qty, MAX_QTY);
  return cart.some((line) => line.sku === sku)
    ? cart.map((line) => (line.sku === sku ? { sku, qty: capped } : line))
    : [...cart, { sku, qty: capped }];
}

export function addToCart(cart: readonly CartLine[], sku: string): CartLine[] {
  return setQty(cart, sku, (cart.find((line) => line.sku === sku)?.qty ?? 0) + 1);
}
