import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function loadOrdersService(): string {
  const candidates = [
    join(process.cwd(), 'apps/backend/src/orders/orders.service.ts'),
    join(process.cwd(), 'src/orders/orders.service.ts'),
    join(__dirname, 'orders.service.ts'),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error('orders.service.ts not found');
  return readFileSync(path, 'utf8');
}

/** Business selection is the second `query GetOrderById` in getOrderById. */
function businessGetOrderByIdQuery(source: string): string {
  const marker = 'query GetOrderById';
  const first = source.indexOf(marker);
  const second = source.indexOf(marker, first + marker.length);
  if (second < 0) throw new Error('business GetOrderById query missing');
  const end = source.indexOf('`;', second);
  return source.slice(second, end);
}

describe('GET /orders/:id MoMo phone flag', () => {
  const query = businessGetOrderByIdQuery(loadOrdersService());

  it('returns whether the location payout phone is verified', () => {
    const location = query.slice(query.indexOf('business_location {'));
    expect(location.startsWith('business_location {')).toBe(true);
    expect(location).toContain('mobile_payment_phone {');
    expect(location).toContain('is_verified');
  });
});
