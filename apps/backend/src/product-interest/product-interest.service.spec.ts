import { HttpException } from '@nestjs/common';
import { ProductInterestService } from './product-interest.service';

describe('ProductInterestService', () => {
  const hasuraSystem = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const hasuraUser = {
    getUser: jest.fn(),
  };
  const notifications = {
    sendBusinessProductInterestNotification: jest.fn(),
  };
  const exportOrders = {
    isExportOrdersEnabled: jest.fn().mockResolvedValue(false),
    createFromInterest: jest.fn(),
  };

  let service: ProductInterestService;

  const clientUser = {
    id: 'u1',
    client: { id: 'c1' },
    first_name: 'A',
    last_name: 'B',
    email: 'a@b.com',
    phone_number: '+123',
  };

  const eligibleInventory = {
    id: 'inv-1',
    is_active: true,
    business_location_id: 'loc-1',
    item_id: 'item-1',
    business_location: {
      id: 'loc-1',
      name: 'Store',
      business_id: 'biz-1',
      business: { id: 'biz-1', name: 'Biz', user_id: 'bu1' },
    },
    item: {
      id: 'item-1',
      name: 'Part',
      export_available: true,
      moderation_status: 'approved',
      is_active: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    exportOrders.isExportOrdersEnabled.mockResolvedValue(false);
    service = new ProductInterestService(
      hasuraSystem as any,
      hasuraUser as any,
      notifications as any,
      exportOrders as any
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function mockCreatedRow() {
    hasuraSystem.executeMutation.mockResolvedValue({
      insert_product_interest_requests_one: {
        id: 'req-1',
        created_at: '2026-09-01T12:00:00.000Z',
        status: 'submitted',
      },
    });
  }

  it('rejects non-clients', async () => {
    hasuraUser.getUser.mockResolvedValue({ id: 'u1', client: null });
    await expect(
      service.createInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects listings that are not export_available', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_inventory_by_pk: {
        ...eligibleInventory,
        item: { ...eligibleInventory.item, export_available: false },
      },
    });
    await expect(
      service.createInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toMatchObject({ response: { error: 'NOT_EXPORT_AVAILABLE' } });
  });

  it('rejects a missing listing', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_inventory_by_pk: null,
    });
    await expect(
      service.createInterest({ businessInventoryId: 'inv-missing' })
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each([
    ['inactive inventory', { is_active: false }],
    [
      'inactive item',
      { item: { ...eligibleInventory.item, is_active: false } },
    ],
    [
      'unapproved item',
      { item: { ...eligibleInventory.item, moderation_status: 'pending' } },
    ],
    ['missing location', { business_location: null }],
  ])('rejects %s as unavailable', async (_label, patch) => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_inventory_by_pk: { ...eligibleInventory, ...patch },
    });
    await expect(
      service.createInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toMatchObject({ status: 400, message: 'Listing is unavailable' });
    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects a second submission inside the 24-hour window', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-01T12:00:00.000Z'));
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery
      .mockResolvedValueOnce({ business_inventory_by_pk: eligibleInventory })
      .mockResolvedValueOnce({
        product_interest_requests: [{ id: 'req-old' }],
      });

    await expect(
      service.createInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toMatchObject({ response: { error: 'DUPLICATE_INTEREST' } });

    expect(hasuraSystem.executeQuery.mock.calls[1][1]).toEqual({
      userId: 'u1',
      inventoryId: 'inv-1',
      since: '2026-08-31T12:00:00.000Z',
    });
    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });

  it('creates interest, trims notes, and notifies the business', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery
      .mockResolvedValueOnce({ business_inventory_by_pk: eligibleInventory })
      .mockResolvedValueOnce({ product_interest_requests: [] });
    mockCreatedRow();

    const result = await service.createInterest({
      businessInventoryId: 'inv-1',
      note: 'Need quote',
    });
    expect(result.id).toBe('req-1');
    expect(hasuraSystem.executeMutation.mock.calls[0][1].object).toEqual({
      client_user_id: 'u1',
      item_id: 'item-1',
      business_inventory_id: 'inv-1',
      business_id: 'biz-1',
      business_location_id: 'loc-1',
      client_note: 'Need quote',
      status: 'submitted',
    });
    expect(
      notifications.sendBusinessProductInterestNotification
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        businessUserId: 'bu1',
        requestId: 'req-1',
        itemName: 'Part',
        clientName: 'A B',
        clientNote: 'Need quote',
      })
    );
  });

  it('stores a blank note as null and still succeeds if notify throws', async () => {
    hasuraUser.getUser.mockResolvedValue({
      id: 'u1',
      client: { id: 'c1' },
    });
    hasuraSystem.executeQuery
      .mockResolvedValueOnce({ business_inventory_by_pk: eligibleInventory })
      .mockResolvedValueOnce({ product_interest_requests: [] });
    mockCreatedRow();
    notifications.sendBusinessProductInterestNotification.mockRejectedValue(
      new Error('smtp down')
    );

    const result = await service.createInterest({
      businessInventoryId: 'inv-1',
      note: '   ',
    });
    expect(result.id).toBe('req-1');
    expect(exportOrders.createFromInterest).not.toHaveBeenCalled();
    expect(
      hasuraSystem.executeMutation.mock.calls[0][1].object.client_note
    ).toBe(null);
    expect(
      notifications.sendBusinessProductInterestNotification
    ).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'A client', clientNote: null })
    );
  });

  it('lists client submissions with sanitized pagination', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery.mockResolvedValue({
      product_interest_requests_aggregate: { aggregate: { count: 3 } },
      product_interest_requests: [{ id: 'req-1' }],
    });

    const result = await service.listForClient(2.9 as any, 100);
    expect(result).toEqual({
      items: [{ id: 'req-1' }],
      total: 3,
      page: 2,
      limit: 50,
      totalPages: 1,
    });
    expect(hasuraSystem.executeQuery.mock.calls[0][1]).toEqual({
      userId: 'u1',
      limit: 50,
      offset: 50,
    });
  });

  it('defaults invalid client page/limit values', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery.mockResolvedValue({
      product_interest_requests_aggregate: { aggregate: { count: 0 } },
      product_interest_requests: [],
    });

    const result = await service.listForClient(0, Number.NaN);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(1);
    expect(hasuraSystem.executeQuery.mock.calls[0][1]).toEqual({
      userId: 'u1',
      limit: 20,
      offset: 0,
    });
  });

  it('rejects business lead lists for non-business users', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    await expect(service.listForBusiness()).rejects.toMatchObject({
      status: 403,
    });
    expect(hasuraSystem.executeQuery).not.toHaveBeenCalled();
  });

  it('scopes business leads to the current business and optional location', async () => {
    hasuraUser.getUser.mockResolvedValue({
      id: 'bu1',
      business: { id: 'biz-1' },
    });
    hasuraSystem.executeQuery.mockResolvedValue({
      product_interest_requests_aggregate: { aggregate: { count: 12 } },
      product_interest_requests: [{ id: 'req-2' }],
    });

    const result = await service.listForBusiness(1, 10, 'loc-9');
    expect(result.total).toBe(12);
    expect(result.totalPages).toBe(2);
    expect(hasuraSystem.executeQuery.mock.calls[0][1]).toEqual({
      where: {
        business_id: { _eq: 'biz-1' },
        business_location_id: { _eq: 'loc-9' },
      },
      limit: 10,
      offset: 0,
    });
  });

  it('rejects non-business users listing leads', async () => {
    hasuraUser.getUser.mockResolvedValue({ id: 'u1', business: null });
    await expect(service.listForBusiness()).rejects.toBeInstanceOf(
      HttpException
    );
    expect(hasuraSystem.executeQuery).not.toHaveBeenCalled();
  });

  it('lists business leads without unused GraphQL variables', async () => {
    hasuraUser.getUser.mockResolvedValue({
      id: 'u1',
      business: { id: 'biz-1' },
    });
    hasuraSystem.executeQuery.mockResolvedValue({
      product_interest_requests_aggregate: { aggregate: { count: 0 } },
      product_interest_requests: [],
    });

    const actual = await service.listForBusiness(1, 20);
    const [query, variables] = hasuraSystem.executeQuery.mock.calls[0];

    expect(actual.items).toEqual([]);
    expect(query).toContain('ListBusinessProductInterest');
    expect(query).not.toMatch(/\$businessId/);
    expect(variables).toEqual({
      where: { business_id: { _eq: 'biz-1' } },
      limit: 20,
      offset: 0,
    });
  });

  it('adds a location filter when listing leads for one store', async () => {
    hasuraUser.getUser.mockResolvedValue({
      id: 'u1',
      business: { id: 'biz-1' },
    });
    hasuraSystem.executeQuery.mockResolvedValue({
      product_interest_requests_aggregate: { aggregate: { count: 1 } },
      product_interest_requests: [{ id: 'req-1' }],
    });

    await service.listForBusiness(1, 20, 'loc-1');
    const [, variables] = hasuraSystem.executeQuery.mock.calls[0];

    expect(variables).toEqual({
      where: {
        business_id: { _eq: 'biz-1' },
        business_location_id: { _eq: 'loc-1' },
      },
      limit: 20,
      offset: 0,
    });
  });

  it('opens an export order instead of a second interest row when the flag is on', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_inventory_by_pk: eligibleInventory,
    });
    exportOrders.isExportOrdersEnabled.mockResolvedValue(true);
    exportOrders.createFromInterest.mockResolvedValue({
      id: 'exp-1',
      created_at: '2026-11-27T15:00:00.000Z',
      status: 'SUBMITTED',
      bc_number: 'BC-9',
    });

    const actual = await service.createInterest({
      businessInventoryId: 'inv-1',
      note: '  Need quote  ',
    });

    expect(actual).toEqual({
      id: 'exp-1',
      created_at: '2026-11-27T15:00:00.000Z',
      status: 'SUBMITTED',
      export_order: true,
      bc_number: 'BC-9',
    });
    expect(exportOrders.isExportOrdersEnabled).toHaveBeenCalledWith('CM');
    expect(exportOrders.createFromInterest).toHaveBeenCalledWith({
      businessInventoryId: 'inv-1',
      note: '  Need quote  ',
      quantity: 1,
      countryCode: 'CM',
    });
    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
    expect(hasuraSystem.executeQuery).toHaveBeenCalledTimes(1);
  });

  it('resolves the flag and the order for the shopper market country', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_inventory_by_pk: eligibleInventory,
    });
    exportOrders.isExportOrdersEnabled.mockResolvedValue(true);
    exportOrders.createFromInterest.mockResolvedValue({
      id: 'exp-2',
      created_at: '2026-11-27T15:00:00.000Z',
      status: 'SUBMITTED',
      bc_number: 'BC-10',
    });

    await service.createInterest({
      businessInventoryId: 'inv-1',
      countryCode: 'ci',
    });

    expect(exportOrders.isExportOrdersEnabled).toHaveBeenCalledWith('CI');
    expect(exportOrders.createFromInterest).toHaveBeenCalledWith(
      expect.objectContaining({ countryCode: 'CI' })
    );
  });

  it('keeps the lead flow when the flag is off for the market country', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery
      .mockResolvedValueOnce({ business_inventory_by_pk: eligibleInventory })
      .mockResolvedValueOnce({ product_interest_requests: [] });
    exportOrders.isExportOrdersEnabled.mockResolvedValue(false);
    mockCreatedRow();

    await service.createInterest({
      businessInventoryId: 'inv-1',
      countryCode: 'CI',
    });

    expect(exportOrders.isExportOrdersEnabled).toHaveBeenCalledWith('CI');
    expect(exportOrders.createFromInterest).not.toHaveBeenCalled();
    expect(hasuraSystem.executeMutation).toHaveBeenCalledTimes(1);
  });

  it('does not fall through to a legacy interest when the export flag check throws', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_inventory_by_pk: eligibleInventory,
    });
    exportOrders.isExportOrdersEnabled.mockRejectedValue(
      new Error('config down')
    );

    await expect(
      service.createInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toThrow('config down');
    expect(exportOrders.createFromInterest).not.toHaveBeenCalled();
    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });

  it('does not insert a legacy interest when export creation fails', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser);
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_inventory_by_pk: eligibleInventory,
    });
    exportOrders.isExportOrdersEnabled.mockResolvedValue(true);
    exportOrders.createFromInterest.mockRejectedValue(new Error('overdue'));

    await expect(
      service.createInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toThrow('overdue');
    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });
});
