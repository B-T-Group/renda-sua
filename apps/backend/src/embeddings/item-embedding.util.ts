export const ITEM_EMBEDDING_DIMENSIONS = 1536;

export function toPgVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

export function normalizeSearchQuery(q: string): string {
  return q
    .trim()
    .slice(0, 64)
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Alphanumeric SKU-style query (no spaces) for exact SKU hybrid match. */
export function isSkuLikeQuery(q: string): boolean {
  const t = q.trim();
  return t.length >= 2 && t.length <= 64 && !/\s/.test(t) && /^[\w.-]+$/i.test(t);
}
