import { describe, expect, it } from 'vitest';
import { buildAdminCatalogItemsSearchParams } from './adminCatalogItemsQuery';

describe('buildAdminCatalogItemsSearchParams', () => {
  it('includes defaults and optional filters', () => {
    const qs = buildAdminCatalogItemsSearchParams({
      q: ' soap ',
      businessId: 'b1',
      moderationStatus: 'approved',
      isActive: true,
      page: 2,
      limit: 10,
    });
    const params = new URLSearchParams(qs);
    expect(params.get('q')).toBe('soap');
    expect(params.get('businessId')).toBe('b1');
    expect(params.get('moderationStatus')).toBe('approved');
    expect(params.get('isActive')).toBe('true');
    expect(params.get('page')).toBe('2');
    expect(params.get('limit')).toBe('10');
  });
});
