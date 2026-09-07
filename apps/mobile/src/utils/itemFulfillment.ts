export function parseShippingPrice(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export function isShippingPriceValid(enabled: boolean, price: string): boolean {
  return !enabled || parseShippingPrice(price) != null;
}
