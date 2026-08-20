const DEFAULT_LIMIT = 50;
const DEFAULT_OFFSET = 0;
const MAX_LIMIT = 200;

export function resolveAdminOrdersPagination(query: {
  limit?: number | string;
  offset?: number | string;
}): { limit: number; offset: number } {
  return {
    limit: toGraphQlInt(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: toGraphQlInt(query.offset, DEFAULT_OFFSET, 0),
  };
}

function toGraphQlInt(
  value: number | string | undefined,
  fallback: number,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }
  return Math.min(parsed, max);
}
