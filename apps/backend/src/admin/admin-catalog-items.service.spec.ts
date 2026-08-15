import { HttpStatus } from '@nestjs/common';
import { AdminCatalogItemsService } from './admin-catalog-items.service';

describe('AdminCatalogItemsService', () => {
  let hasura: { executeQuery: jest.Mock };
  let businessItems: { adminUpdateItem: jest.Mock };
  let service: AdminCatalogItemsService;

  const activeRow = {
    id: 'item-1',
    name: 'Soap',
    sku: 'SOAP-1',
    price: 5,
    currency: 'XAF',
    is_active: true,
    moderation_status: 'approved',
    created_at: '2026-08-01T00:00:00.000Z',
    status: 'active',
    business: { id: 'biz-1', name: 'Acme' },
    item_images: [
      {
        id: 'img-1',
        image_url: 'orig',
        rembg_image_url: 'rembg',
        enhanced_image_url: 'ai',
        active_version: 'rembg',
        display_order: 0,
        is_ai_cleaned: false,
        is_rembg_cleaned: true,
      },
    ],
  };

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    businessItems = { adminUpdateItem: jest.fn().mockResolvedValue(undefined) };
    service = new AdminCatalogItemsService(hasura as any, businessItems as any);
  });

  it('clamps list page size to 50 and maps the active image version', async () => {
    hasura.executeQuery.mockResolvedValue({
      items: [activeRow],
      items_aggregate: { aggregate: { count: 1 } },
    });

    const result = await service.list({ page: 2, limit: 200 } as any);

    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 50, offset: 50 })
    );
    expect(result.pagination).toEqual({
      page: 2,
      limit: 50,
      total: 1,
      totalPages: 1,
    });
    expect(result.items[0].thumbnailUrl).toBe('rembg');
  });

  it('returns 404 for a missing or soft-deleted item', async () => {
    hasura.executeQuery.mockResolvedValue({ items_by_pk: null });
    await expect(service.getById('missing')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });

    hasura.executeQuery.mockResolvedValue({
      items_by_pk: { ...activeRow, status: 'deleted' },
    });
    await expect(service.getById('item-1')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('maps rembg/AI versions on detail and updates through adminUpdateItem', async () => {
    hasura.executeQuery.mockResolvedValue({ items_by_pk: activeRow });
    const detail = await service.getById('item-1');
    expect(detail.images[0]).toEqual(
      expect.objectContaining({
        imageUrl: 'rembg',
        originalUrl: 'orig',
        rembgUrl: 'rembg',
        enhancedUrl: 'ai',
        activeVersion: 'rembg',
        isRembgCleaned: true,
        isAiCleaned: false,
      })
    );

    await service.update('item-1', { name: 'Soap 2' } as any);
    expect(businessItems.adminUpdateItem).toHaveBeenCalledWith('item-1', {
      name: 'Soap 2',
    });
  });
});
