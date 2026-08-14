import { buildAdminCatalogItemsWhere, resolveCatalogImageUrl } from './admin-catalog-items.util';

describe('admin-catalog-items.util', () => {
  describe('buildAdminCatalogItemsWhere', () => {
    it('returns empty object when no filters', () => {
      expect(buildAdminCatalogItemsWhere({})).toEqual({
        _and: [{ status: { _eq: 'active' } }],
      });
    });

    it('builds text, business, date, status, and active filters', () => {
      const where = buildAdminCatalogItemsWhere({
        q: 'soap',
        businessId: 'b1',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-02-01T00:00:00.000Z',
        moderationStatus: 'approved',
        isActive: true,
      });
      expect(where).toEqual({
        _and: [
          {
            _or: [
              { name: { _ilike: '%soap%' } },
              { sku: { _ilike: '%soap%' } },
              { description: { _ilike: '%soap%' } },
            ],
          },
          { business_id: { _eq: 'b1' } },
          {
            created_at: {
              _gte: '2026-01-01T00:00:00.000Z',
              _lte: '2026-02-01T00:00:00.000Z',
            },
          },
          { moderation_status: { _eq: 'approved' } },
          { is_active: { _eq: true } },
          { status: { _eq: 'active' } },
        ],
      });
    });
  });

  describe('resolveCatalogImageUrl', () => {
    it('prefers rembg or enhanced when active', () => {
      expect(
        resolveCatalogImageUrl({
          image_url: 'orig',
          rembg_image_url: 'rembg',
          active_version: 'rembg',
        })
      ).toBe('rembg');
      expect(
        resolveCatalogImageUrl({
          image_url: 'orig',
          enhanced_image_url: 'ai',
          active_version: 'enhanced',
        })
      ).toBe('ai');
      expect(
        resolveCatalogImageUrl({
          image_url: 'orig',
          active_version: 'original',
        })
      ).toBe('orig');
    });
  });
});
