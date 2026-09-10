const DEFAULT_ERROR_TEXT = 'Unknown error';

export function toStoredErrorText(
  value: unknown,
  fallback = DEFAULT_ERROR_TEXT,
  maxLength?: number
): string {
  const text = resolveErrorText(value, fallback);
  return maxLength != null ? text.slice(0, maxLength) : text;
}

function resolveErrorText(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    return value.trim() || fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return joinStringItems(value, fallback);
  }
  return stringifyObject(value, fallback);
}

function joinStringItems(value: unknown[], fallback: string): string {
  const parts = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join('; ') : fallback;
}

function stringifyObject(value: unknown, fallback: string): string {
  if (value == null || typeof value !== 'object') {
    return fallback;
  }
  try {
    const serialized = JSON.stringify(value);
    return serialized && serialized !== '{}' ? serialized : fallback;
  } catch {
    return fallback;
  }
}
