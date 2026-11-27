import { ExportOrdersService } from './export-orders.service';

describe('ExportOrdersService.isExportOrdersEnabled', () => {
  function serviceWith(hasura: { executeQuery: jest.Mock }) {
    return new ExportOrdersService(
      hasura as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  }

  it('returns false when no config rows', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        application_configurations: [],
      }),
    };
    await expect(serviceWith(hasura).isExportOrdersEnabled()).resolves.toBe(
      false
    );
  });

  it('prefers country row over global', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        application_configurations: [
          { boolean_value: true, country_code: 'CM' },
          { boolean_value: false, country_code: null },
        ],
      }),
    };
    await expect(serviceWith(hasura).isExportOrdersEnabled('CM')).resolves.toBe(
      true
    );
  });

  it('does not inherit a global open flag when the country row is closed', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        application_configurations: [
          { boolean_value: false, country_code: 'CM' },
          { boolean_value: true, country_code: null },
        ],
      }),
    };
    await expect(serviceWith(hasura).isExportOrdersEnabled('CM')).resolves.toBe(
      false
    );
  });

  it('uses the global row when the country value is null, unknown, or padded', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        application_configurations: [
          { boolean_value: null, country_code: 'CM' },
          { boolean_value: true, country_code: 'GA' },
          { boolean_value: false, country_code: null },
        ],
      }),
    };
    const service = serviceWith(hasura);
    await expect(service.isExportOrdersEnabled('CM')).resolves.toBe(false);
    await expect(service.isExportOrdersEnabled('GA')).resolves.toBe(true);
    await expect(service.isExportOrdersEnabled('CI')).resolves.toBe(false);
    await expect(service.isExportOrdersEnabled()).resolves.toBe(false);
    await expect(service.isExportOrdersEnabled(' CM')).resolves.toBe(false);
  });

  it('stays closed when the config query throws', async () => {
    const hasura = {
      executeQuery: jest.fn().mockRejectedValue(new Error('config down')),
    };
    await expect(serviceWith(hasura).isExportOrdersEnabled('CM')).resolves.toBe(
      false
    );
  });
});

describe('ExportOrdersService create, list, and resubmit', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const hasuraUser = { getUser: jest.fn() };
  const transitions = { getOrder: jest.fn(), transition: jest.fn() };
  const notifications = {
    sendBusinessProductInterestNotification: jest.fn(),
  };
  const pdf = { issueBc: jest.fn() };
  let service: ExportOrdersService;

  const inventory = {
    id: 'inv-1',
    is_active: true,
    business_location_id: 'loc-1',
    item_id: 'item-1',
    business_location: {
      id: 'loc-1',
      name: ' Store ',
      business_id: 'biz-1',
      business: { id: 'biz-1', name: 'Biz', user_id: 'bu1' },
    },
    item: {
      id: 'item-1',
      name: 'Widget',
      description: null,
      export_available: true,
      moderation_status: 'approved',
      is_active: true,
    },
  };

  const storedOrder = {
    id: 'order-1',
    status: 'CHANGES_REQUESTED',
    client_user_id: 'user-1',
    bc_version: 1,
    client_note: 'keep',
    lines: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    service = new ExportOrdersService(
      hasura as any,
      hasuraUser as any,
      transitions as any,
      notifications as any,
      pdf as any
    );
    hasuraUser.getUser.mockResolvedValue({
      id: 'user-1',
      client: { id: 'client-1' },
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
    });
    pdf.issueBc.mockResolvedValue({ id: 'doc-1' });
    notifications.sendBusinessProductInterestNotification.mockResolvedValue(
      undefined
    );
    transitions.getOrder.mockResolvedValue(storedOrder);
    hasura.executeMutation.mockResolvedValue({
      insert_export_order_versions_one: { id: 'ver-1' },
    });
    transitions.transition.mockImplementation(async (params: any) => ({
      ...storedOrder,
      status: params.to,
      ...params.extraSet,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function enable(
    rows: Array<{ boolean_value: boolean | null; country_code: string | null }>
  ) {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ExportOrdersEnabled')) {
        return { application_configurations: rows };
      }
      if (query.includes('GetInventoryForExport')) {
        return { business_inventory_by_pk: inventory };
      }
      if (query.includes('OverdueFinancing')) return { export_financing: [] };
      if (query.includes('GetClientReferral')) {
        return { clients: [{ id: 'c1', referred_by_user_id: 'agent-9' }] };
      }
      if (query.includes('GetExportOrder')) {
        return { export_orders_by_pk: storedOrder };
      }
      throw new Error(query.slice(0, 48));
    });
    hasura.executeMutation.mockImplementation(
      async (query: string, vars: any) => {
        if (query.includes('InsertExportOrder')) {
          return {
            insert_export_orders_one: {
              id: 'order-1',
              bc_number: 'BC-9',
              client_user_id: 'user-1',
              agent_user_id: vars.object.agent_user_id,
            },
          };
        }
        if (query.includes('InsertOrderVersion')) {
          return { insert_export_order_versions_one: { id: 'ver-1' } };
        }
        throw new Error(query.slice(0, 48));
      }
    );
  }

  it('rejects a user who is not a client before reading the listing', async () => {
    hasuraUser.getUser.mockResolvedValue({ id: 'user-1' });
    await expect(
      service.createFromInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toMatchObject({
      status: 403,
      message: 'Only clients can submit export interest',
    });
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('rejects a missing, inactive, or non-export listing', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      business_inventory_by_pk: null,
    });
    await expect(
      service.createFromInterest({ businessInventoryId: 'missing' })
    ).rejects.toMatchObject({ status: 404, message: 'Listing not found' });

    hasura.executeQuery.mockResolvedValueOnce({
      business_inventory_by_pk: { ...inventory, is_active: false },
    });
    await expect(
      service.createFromInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toMatchObject({ status: 400, message: 'Listing is unavailable' });

    hasura.executeQuery.mockResolvedValueOnce({
      business_inventory_by_pk: {
        ...inventory,
        item: { ...inventory.item, export_available: false },
      },
    });
    await expect(
      service.createFromInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Listing is not available for export orders',
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('does not insert when the country flag is closed or financing is overdue', async () => {
    enable([
      { boolean_value: false, country_code: 'CM' },
      { boolean_value: true, country_code: null },
    ]);
    await expect(
      service.createFromInterest({
        businessInventoryId: 'inv-1',
        countryCode: 'cm',
      })
    ).rejects.toMatchObject({
      status: 400,
      response: { error: 'EXPORT_ORDERS_DISABLED' },
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();

    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ExportOrdersEnabled')) {
        return {
          application_configurations: [
            { boolean_value: true, country_code: null },
          ],
        };
      }
      if (query.includes('GetInventoryForExport')) {
        return { business_inventory_by_pk: inventory };
      }
      if (query.includes('OverdueFinancing')) {
        return { export_financing: [{ id: 'fin-1' }] };
      }
      throw new Error(query.slice(0, 48));
    });
    await expect(
      service.createFromInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toMatchObject({
      status: 400,
      message: 'New export orders blocked: overdue financing',
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('stores one unit, a trimmed note, and the referring agent', async () => {
    enable([{ boolean_value: true, country_code: null }]);
    const created = await service.createFromInterest({
      businessInventoryId: 'inv-1',
      countryCode: 'ga',
      quantity: 0,
      note: '  hello  ',
      characteristics: '   ',
      particularities: '  rush  ',
    });

    const inserted = hasura.executeMutation.mock.calls.find((call) =>
      String(call[0]).includes('InsertExportOrder')
    )[1].object;
    expect(inserted.country_code).toBe('GA');
    expect(inserted.currency).toBe('CAD');
    expect(inserted.agent_user_id).toBe('agent-9');
    expect(inserted.client_note).toBe('hello');
    expect(inserted.lines.data[0]).toEqual(
      expect.objectContaining({
        quantity: 1,
        characteristics: null,
        particularities: 'rush',
        product_name: 'Widget',
      })
    );
    expect(created).toEqual(storedOrder);
    expect(
      notifications.sendBusinessProductInterestNotification
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        businessUserId: 'bu1',
        clientNote: 'Export order BC-9',
        clientName: 'Ada Lovelace',
      })
    );
  });

  it('keeps the order when the BC pdf or the business notice fails', async () => {
    enable([{ boolean_value: true, country_code: null }]);
    pdf.issueBc.mockRejectedValue(new Error('pdf down'));
    await expect(
      service.createFromInterest({
        businessInventoryId: 'inv-1',
        quantity: -2,
      })
    ).resolves.toEqual(storedOrder);

    notifications.sendBusinessProductInterestNotification.mockRejectedValue(
      new Error('smtp down')
    );
    pdf.issueBc.mockResolvedValue({ id: 'doc-1' });
    await expect(
      service.createFromInterest({ businessInventoryId: 'inv-1', quantity: 3 })
    ).resolves.toEqual(storedOrder);
    const quantities = hasura.executeMutation.mock.calls
      .filter((call) => String(call[0]).includes('InsertExportOrder'))
      .map((call) => call[1].object.lines.data[0].quantity);
    expect(quantities).toEqual([1, 3]);
  });

  it('scopes the list to the actor and clamps page bounds', async () => {
    hasuraUser.getUser.mockResolvedValue({ id: 'user-1', business: null });
    await expect(
      service.listForActor({ role: 'business' })
    ).rejects.toMatchObject({ status: 403, message: 'Business required' });
    expect(hasura.executeQuery).not.toHaveBeenCalled();

    hasura.executeQuery.mockResolvedValue({
      export_orders: [{ id: 'order-1' }],
      export_orders_aggregate: { aggregate: { count: 0 } },
    });
    hasuraUser.getUser.mockResolvedValue({
      id: 'agent-user',
      agent: { id: 'ag-other' },
    });
    const listed = await service.listForActor({
      role: 'agent',
      page: '2' as any,
      limit: '999' as any,
      status: 'SUBMITTED',
    });
    expect(listed).toEqual({
      items: [{ id: 'order-1' }],
      total: 0,
      page: 2,
      limit: 50,
      totalPages: 1,
    });
    expect(hasura.executeQuery.mock.calls[0][1]).toEqual({
      where: {
        status: { _eq: 'SUBMITTED' },
        agent_user_id: { _eq: 'agent-user' },
      },
      limit: 50,
      offset: 50,
    });

    hasuraUser.getUser.mockResolvedValue({
      id: 'biz-user',
      business: { id: 'biz-9' },
    });
    hasura.executeQuery.mockResolvedValue({
      export_orders: null,
      export_orders_aggregate: null,
    });
    const businessPage = await service.listForActor({
      role: 'business',
      page: 0,
      limit: 0,
    });
    expect(businessPage).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 1,
      totalPages: 1,
    });
    expect(hasura.executeQuery.mock.calls[1][1]).toEqual({
      where: { business_id: { _eq: 'biz-9' } },
      limit: 1,
      offset: 0,
    });

    hasuraUser.getUser.mockResolvedValue({ id: 'admin-1' });
    hasura.executeQuery.mockResolvedValue({
      export_orders: [],
      export_orders_aggregate: { aggregate: { count: 41 } },
    });
    const adminPage = await service.listForActor({
      role: 'admin',
      page: Number.NaN,
      limit: -4,
    });
    expect(adminPage.page).toBe(1);
    expect(adminPage.limit).toBe(1);
    expect(adminPage.totalPages).toBe(41);
    expect(hasura.executeQuery.mock.calls[2][1].where).toEqual({});
  });

  it('refuses another client and bumps the BC version for the owner', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-27T15:00:00.000Z'));
    hasuraUser.getUser.mockResolvedValue({ id: 'other' });
    transitions.getOrder.mockResolvedValue(storedOrder);
    await expect(
      service.clientResubmitAfterChanges('order-1', 'updated')
    ).rejects.toMatchObject({ status: 403, message: 'Forbidden' });
    expect(transitions.transition).not.toHaveBeenCalled();

    hasuraUser.getUser.mockResolvedValue({
      id: 'user-1',
      client: { id: 'c1' },
    });
    const updated = await service.clientResubmitAfterChanges('order-1', '   ');
    expect(transitions.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'IN_REVIEW',
        actorRole: 'client',
        extraSet: expect.objectContaining({
          bc_version: 2,
          client_note: 'keep',
          bc_expires_at: '2026-12-27T15:00:00.000Z',
        }),
      })
    );
    expect(updated.bc_version).toBe(2);
    const snapshot = hasura.executeMutation.mock.calls.find((call) =>
      String(call[0]).includes('InsertOrderVersion')
    );
    expect(snapshot[1].object.version_number).toBe(2);
    expect(snapshot[1].object.version_kind).toBe('BC');
  });
});
