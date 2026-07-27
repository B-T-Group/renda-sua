import { ItemsService } from './items.service';

describe('ItemsService privileged field filtering', () => {
  const ownedItem = {
    id: 'item-1',
    business_id: 'business-1',
    name: 'Old name',
    description: 'Old description',
    moderation_status: 'draft',
  };

  function createService() {
    const hasuraUser = {
      executeQuery: jest.fn().mockResolvedValue({ items_by_pk: ownedItem }),
    };
    const hasuraSystem = {
      executeMutation: jest.fn(),
    };
    const embeddings = {
      syncItemEmbeddings: jest.fn().mockResolvedValue(undefined),
    };
    const activation = {
      assertItemCanActivate: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ItemsService(
      hasuraUser as any,
      hasuraSystem as any,
      embeddings as any,
      activation as any
    );
    return { service, hasuraSystem };
  }

  it('forces ownership and moderation defaults when creating an item', async () => {
    const { service, hasuraSystem } = createService();
    hasuraSystem.executeMutation.mockResolvedValue({
      insert_items_one: {
        id: 'item-1',
        name: 'Safe item',
        description: '',
        sku: null,
      },
    });

    await service.createItem('business-1', {
      name: 'Safe item',
      business_id: 'victim-business',
      moderation_status: 'approved',
      is_active: true,
    });

    expect(hasuraSystem.executeMutation.mock.calls[0][1].itemData).toEqual({
      name: 'Safe item',
      business_id: 'business-1',
      is_active: false,
    });
  });

  it('drops privileged fields when updating an item', async () => {
    const { service, hasuraSystem } = createService();
    hasuraSystem.executeMutation.mockResolvedValue({
      update_items_by_pk: { id: 'item-1', name: 'New name' },
    });

    await service.updateItem('business-1', 'item-1', {
      name: 'New name',
      business_id: 'victim-business',
      moderation_status: 'approved',
      created_at: '2026-01-01T00:00:00Z',
    });

    expect(hasuraSystem.executeMutation.mock.calls[0][1].itemData).toEqual({
      name: 'New name',
    });
  });
});
