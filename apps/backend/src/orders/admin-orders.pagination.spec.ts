import { resolveAdminOrdersPagination } from './admin-orders.pagination';

describe('resolveAdminOrdersPagination', () => {
  it('coerces query-string limit and offset to GraphQL Ints', () => {
    const actual = resolveAdminOrdersPagination({
      limit: '50',
      offset: '0',
    });

    expect(actual).toEqual({ limit: 50, offset: 0 });
    expect(typeof actual.limit).toBe('number');
    expect(typeof actual.offset).toBe('number');
  });

  it('keeps numeric values unchanged', () => {
    expect(resolveAdminOrdersPagination({ limit: 25, offset: 75 })).toEqual({
      limit: 25,
      offset: 75,
    });
  });

  it('falls back when limit or offset is missing or invalid', () => {
    expect(resolveAdminOrdersPagination({})).toEqual({ limit: 50, offset: 0 });
    expect(resolveAdminOrdersPagination({ limit: 'abc', offset: 'x' })).toEqual({
      limit: 50,
      offset: 0,
    });
    expect(resolveAdminOrdersPagination({ limit: '-1', offset: '-5' })).toEqual({
      limit: 50,
      offset: 0,
    });
  });

  it('caps oversized limits', () => {
    expect(resolveAdminOrdersPagination({ limit: '500', offset: '10' })).toEqual({
      limit: 200,
      offset: 10,
    });
  });
});
