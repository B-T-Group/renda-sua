import { HttpException, HttpStatus } from '@nestjs/common';

/** `items.price`, `items.weight`, and `items.shipping_price` are DECIMAL(10,2). */
export const ITEM_DECIMAL_FIELDS = [
  'price',
  'weight',
  'shipping_price',
] as const;

const MAX_ABS_CENTS = 9_999_999_999;

export function assertItemDecimalField(field: string, value: unknown): void {
  if (!isItemDecimalField(field) || value == null) return;
  if (!exceedsItemDecimal(value)) return;
  throw overflowError(`${field} exceeds the allowed range (max 99,999,999.99)`);
}

export function rethrowNumericOverflow(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes('numeric field overflow')) return;
  throw overflowError(
    'A numeric field exceeds the allowed range (max 99,999,999.99)'
  );
}

function overflowError(error: string): HttpException {
  return new HttpException(
    { success: false, error, code: 'NUMERIC_FIELD_OVERFLOW' },
    HttpStatus.BAD_REQUEST
  );
}

function isItemDecimalField(
  field: string
): field is (typeof ITEM_DECIMAL_FIELDS)[number] {
  return (ITEM_DECIMAL_FIELDS as readonly string[]).includes(field);
}

function exceedsItemDecimal(value: unknown): boolean {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return true;
  const cents = Math.round(Math.abs(n) * 100);
  return !Number.isFinite(cents) || cents > MAX_ABS_CENTS;
}
