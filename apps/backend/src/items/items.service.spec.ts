import { ItemsService } from './items.service';

describe('ItemsService privileged field filtering', () => {
  const ownedItem = {
    id: 'item-1',
    business_id: 'business-1',
    name: 'Old name',
    description: 'Old description',
    moderation_status: 'draft',
    shipping_enabled: false,
    shipping_price: null,
  };

  function createService(item = ownedItem) {
    const hasuraUser = {
      executeQuery: jest.fn().mockResolvedValue({ items_by_pk: item }),
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
      moderation_status: 'draft',
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

  it('persists shipping fields when updating an item', async () => {
    const { service, hasuraSystem } = createService();
    hasuraSystem.executeMutation.mockResolvedValue({
      update_items_by_pk: { id: 'item-1', shipping_enabled: true },
    });

    await service.updateItem('business-1', 'item-1', {
      shipping_enabled: true,
      shipping_price: 2500,
      shipping_currency: 'XAF',
    });

    expect(hasuraSystem.executeMutation.mock.calls[0][1].itemData).toEqual({
      shipping_enabled: true,
      shipping_price: 2500,
      shipping_currency: 'XAF',
    });
  });

  it('enables shipping using the existing shipping_price when price is omitted', async () => {
    const { service, hasuraSystem } = createService({
      ...ownedItem,
      shipping_enabled: false,
      shipping_price: 2500,
    });
    hasuraSystem.executeMutation.mockResolvedValue({
      update_items_by_pk: { id: 'item-1', shipping_enabled: true },
    });

    await service.updateItem('business-1', 'item-1', {
      shipping_enabled: true,
    });

    expect(hasuraSystem.executeMutation.mock.calls[0][1].itemData).toEqual({
      shipping_enabled: true,
    });
  });

  it('rejects shipping_enabled without a valid shipping_price', async () => {
    const { service, hasuraSystem } = createService();

    await expect(
      service.updateItem('business-1', 'item-1', {
        shipping_enabled: true,
      })
    ).rejects.toMatchObject({ status: 400 });

    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects clearing shipping_price while shipping remains enabled', async () => {
    const { service, hasuraSystem } = createService({
      ...ownedItem,
      shipping_enabled: true,
      shipping_price: 2500,
    });

    await expect(
      service.updateItem('business-1', 'item-1', {
        shipping_price: null,
      })
    ).rejects.toMatchObject({ status: 400 });

    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects DECIMAL(10,2) overflow before calling Hasura', async () => {
    const { service, hasuraSystem } = createService();

    await expect(
      service.updateItem('business-1', 'item-1', { price: 100_000_000 })
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'NUMERIC_FIELD_OVERFLOW' },
    });

    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });

  it('maps leftover Hasura numeric overflow to HTTP 400', async () => {
    const { service, hasuraSystem } = createService();
    hasuraSystem.executeMutation.mockRejectedValue(
      new Error('numeric field overflow: {"response":{"errors":[]}}')
    );

    await expect(
      service.updateItem('business-1', 'item-1', { price: 12.5 })
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'NUMERIC_FIELD_OVERFLOW' },
    });
  });

  it('rejects overflow on create as well', async () => {
    const { service, hasuraSystem } = createService();

    await expect(
      service.createItem('business-1', {
        name: 'Huge price',
        price: 1e20,
      })
    ).rejects.toMatchObject({ status: 400 });

    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });

  it('persists interest_only on create', async () => {
    const { service, hasuraSystem } = createService();
    hasuraSystem.executeMutation.mockResolvedValue({
      insert_items_one: {
        id: 'item-1',
        name: 'Quote part',
        description: '',
        sku: null,
      },
    });

    await service.createItem('business-1', {
      name: 'Quote part',
      interest_only: true,
      price: 0,
    });

    expect(hasuraSystem.executeMutation.mock.calls[0][1].itemData).toEqual({
      name: 'Quote part',
      interest_only: true,
      price: 0,
      business_id: 'business-1',
      is_active: false,
      moderation_status: 'draft',
    });
  });

  it('rejects turning off interest-only without a shopper price', async () => {
    const { service, hasuraSystem } = createService({
      ...ownedItem,
      interest_only: true,
      price: 0,
    });

    await expect(
      service.updateItem('business-1', 'item-1', { interest_only: false })
    ).rejects.toMatchObject({
      status: 400,
      response: { error: 'PRICE_REQUIRED' },
    });
    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects turning off interest-only when the new price is not positive', async () => {
    const { service, hasuraSystem } = createService({
      ...ownedItem,
      interest_only: true,
      price: 1500,
    });

    await expect(
      service.updateItem('business-1', 'item-1', {
        interest_only: false,
        price: 0,
      })
    ).rejects.toMatchObject({
      status: 400,
      response: { error: 'PRICE_REQUIRED' },
    });
    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });

  it('allows turning off interest-only when a positive price is already stored', async () => {
    const { service, hasuraSystem } = createService({
      ...ownedItem,
      interest_only: true,
      price: 1500,
    });
    hasuraSystem.executeMutation.mockResolvedValue({
      update_items_by_pk: { id: 'item-1', interest_only: false },
    });

    await service.updateItem('business-1', 'item-1', { interest_only: false });

    expect(hasuraSystem.executeMutation.mock.calls[0][1].itemData).toEqual({
      interest_only: false,
    });
  });

  it('allows turning off interest-only when the update supplies a price', async () => {
    const { service, hasuraSystem } = createService({
      ...ownedItem,
      interest_only: true,
      price: null,
    });
    hasuraSystem.executeMutation.mockResolvedValue({
      update_items_by_pk: { id: 'item-1', interest_only: false },
    });

    await service.updateItem('business-1', 'item-1', {
      interest_only: false,
      price: 2500,
    });

    expect(hasuraSystem.executeMutation.mock.calls[0][1].itemData).toEqual({
      interest_only: false,
      price: 2500,
    });
  });
});
