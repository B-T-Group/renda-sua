/** Hasura `_or` for catalog lexical fallback (name, description, SKU, brand). */
export function buildLexicalItemSearchOr(q: string): Record<string, unknown> {
  const pattern = `%${q}%`;
  return {
    _or: [
      { item: { name: { _ilike: pattern } } },
      { item: { description: { _ilike: pattern } } },
      { item: { sku: { _ilike: pattern } } },
      { item: { brand: { name: { _ilike: pattern } } } },
    ],
  };
}
