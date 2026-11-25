import { ConfigurationsService } from '../admin/configurations.service';

describe('ConfigurationsService', () => {
  let service: ConfigurationsService;
  let hasura: { executeQuery: jest.Mock };
  let rbac: { hasRole: jest.Mock };

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    rbac = { hasRole: jest.fn(async () => true) };
    service = new ConfigurationsService(hasura as any, rbac as any);
  });

  it('returns active configuration by key and country', async () => {
    const configuration = { id: 'cfg-1', config_key: 'fast_delivery' };
    hasura.executeQuery.mockResolvedValue({
      application_configurations: [configuration],
    });

    await expect(
      service.getConfigurationByKey('fast_delivery', 'GA')
    ).resolves.toEqual(configuration);

    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('country_code: { _eq: $country_code }'),
      { config_key: 'fast_delivery', country_code: 'GA' }
    );
  });

  it('rejects a FedaPay lag or confirm gap below 10 minutes', async () => {
    hasura.executeQuery.mockResolvedValue({
      application_configurations_by_pk: {
        id: 'cfg-1',
        config_key: 'rentals_fedapay_list_lag_minutes',
        number_value: 10,
      },
    });
    await expect(service.updateConfiguration('cfg-1', { number_value: 1 }, 'user-1')).rejects.toThrow(/10 minutes and 24 hours/);
    expect(hasura.executeQuery).toHaveBeenCalledTimes(1);
    await expect(service.updateConfiguration('cfg-1', { number_value: 1_000_000 }, 'user-1')).rejects.toThrow(/24 hours/);
    rbac.hasRole.mockResolvedValue(false);
    await expect(service.updateConfiguration('cfg-1', { number_value: 15 }, 'user-1')).rejects.toThrow(/superuser/);
  });

  it('treats a rename into a FedaPay timing key as a superuser change', async () => {
    hasura.executeQuery.mockResolvedValue({
      application_configurations_by_pk: {
        id: 'cfg-1',
        config_key: 'rendasua_item_commission_percentage',
        number_value: 10,
      },
    });
    rbac.hasRole.mockResolvedValue(false);
    const rename = { config_key: 'rentals_fedapay_list_lag_minutes', number_value: 1440 };
    await expect(service.updateConfiguration('cfg-1', rename, 'user-1')).rejects.toThrow(/superuser/);
    rbac.hasRole.mockResolvedValue(true);
    await expect(service.updateConfiguration('cfg-1', { config_key: 'rentals_fedapay_unknown_notice_after', number_value: 0.5 }, 'user-1')).rejects.toThrow(/1 and 100/);
    expect(hasura.executeQuery).toHaveBeenCalledTimes(2);
  });

  it('maps a rename onto an existing key to a conflict', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        application_configurations_by_pk: { id: 'cfg-1', config_key: 'fast_delivery', number_value: 1 },
      })
      .mockRejectedValueOnce(new Error('Uniqueness violation. duplicate key value violates unique constraint "application_configurations_global_key_uidx"'));
    await expect(service.updateConfiguration('cfg-1', { config_key: 'taken_key' }, 'user-1')).rejects.toThrow(/already exists/);
  });

  it('refuses a platform user who deletes a FedaPay timing key', async () => {
    hasura.executeQuery.mockResolvedValue({
      application_configurations_by_pk: { id: 'cfg-1', config_key: 'rentals_fedapay_list_lag_minutes' },
    });
    rbac.hasRole.mockResolvedValue(false);
    await expect(service.deleteConfiguration('cfg-1', 'user-1')).rejects.toThrow(/superuser/);
    expect(hasura.executeQuery).toHaveBeenCalledTimes(1);
    rbac.hasRole.mockResolvedValue(true);
    hasura.executeQuery.mockResolvedValueOnce({
      application_configurations_by_pk: { id: 'cfg-1', config_key: 'rentals_fedapay_list_lag_minutes' },
    }).mockResolvedValueOnce({ delete_application_configurations_by_pk: { id: 'cfg-1' } });
    await expect(service.deleteConfiguration('cfg-1', 'user-1')).resolves.toBe(true);
  });

  it('returns null when no active configuration exists', async () => {
    hasura.executeQuery.mockResolvedValue({ application_configurations: [] });

    await expect(service.getConfigurationByKey('missing')).resolves.toBeNull();
  });

  it('accepts the inclusive FedaPay windows and refuses the next step outside them', async () => {
    hasura.executeQuery.mockResolvedValue(stored('rentals_fedapay_list_confirm_minutes', 10));
    await expect(service.updateConfiguration('cfg-1', { number_value: 10 }, 'user-1')).resolves.toMatchObject({
      number_value: 10,
    });
    await expect(service.updateConfiguration('cfg-1', { number_value: 9 }, 'user-1')).rejects.toMatchObject({
      status: 400,
    });
    hasura.executeQuery.mockResolvedValue(stored('rentals_fedapay_list_lag_minutes', 1440));
    await expect(service.updateConfiguration('cfg-1', { number_value: 24 * 60 }, 'user-1')).resolves.toMatchObject({
      number_value: 1440,
    });
    await expect(service.updateConfiguration('cfg-1', { number_value: 1441 }, 'user-1')).rejects.toThrow(/24 hours/);
    await expect(service.updateConfiguration('cfg-1', { number_value: Number.NaN }, 'user-1')).rejects.toMatchObject({
      status: 400,
    });
    expect(updatePayloads(hasura).map((row) => row.number_value)).toEqual([10, 1440]);
  });

  it('keeps the unknown-notice streak between 1 and 100', async () => {
    hasura.executeQuery.mockResolvedValue(stored('rentals_fedapay_unknown_notice_after', 1));
    await expect(service.updateConfiguration('cfg-1', { number_value: 1 }, 'user-1')).resolves.toMatchObject({
      number_value: 1,
    });
    await expect(service.updateConfiguration('cfg-1', { number_value: 100 }, 'user-1')).resolves.toBeTruthy();
    await expect(service.updateConfiguration('cfg-1', { number_value: 0 }, 'user-1')).rejects.toThrow(/1 and 100/);
    await expect(service.updateConfiguration('cfg-1', { number_value: 101 }, 'user-1')).rejects.toMatchObject({
      status: 400,
    });
    expect(updatePayloads(hasura)).toHaveLength(2);
  });

  it('refuses a timing change with no actor and with no role service', async () => {
    hasura.executeQuery.mockResolvedValue(stored('rentals_fedapay_list_lag_minutes', 15));
    await expect(service.updateConfiguration('cfg-1', { number_value: 15 })).rejects.toMatchObject({ status: 403 });
    await expect(service.updateConfiguration('cfg-1', { description: 'later' }, 'user-1')).resolves.toBeTruthy();
    rbac.hasRole.mockResolvedValue(false);
    await expect(
      service.updateConfiguration('cfg-1', { config_key: 'fast_delivery' }, 'user-1')
    ).rejects.toThrow(/superuser/);
    const bare = new ConfigurationsService(hasura as any);
    await expect(bare.updateConfiguration('cfg-1', { number_value: 15 }, 'user-1')).rejects.toMatchObject({
      status: 403,
    });
    const wroteFastDelivery = hasura.executeQuery.mock.calls.some((call) => call[1]?.updates?.config_key === 'fast_delivery');
    expect(wroteFastDelivery).toBe(false);
  });

  it('maps a GraphQL uniqueness error to a conflict and rethrows other write errors', async () => {
    hasura.executeQuery.mockResolvedValueOnce(stored('fast_delivery', 1)).mockRejectedValueOnce(graphqlUnique());
    await expect(service.updateConfiguration('cfg-1', { config_key: 'taken_key' }, 'user-1')).rejects.toMatchObject({
      status: 409,
    });
    const reset = new Error('connection reset');
    hasura.executeQuery.mockResolvedValueOnce(stored('fast_delivery', 1)).mockRejectedValueOnce(reset);
    await expect(service.updateConfiguration('cfg-1', { config_key: 'other_key' }, 'user-1')).rejects.toBe(reset);
  });

  it('lets a platform user delete an ordinary key and refuses every FedaPay timing key', async () => {
    rbac.hasRole.mockResolvedValue(false);
    for (const key of [
      'rentals_fedapay_list_lag_minutes',
      'rentals_fedapay_list_confirm_minutes',
      'rentals_fedapay_unknown_notice_after',
    ]) {
      hasura.executeQuery.mockResolvedValue(stored(key, 10));
      await expect(service.deleteConfiguration('cfg-1', 'user-1')).rejects.toMatchObject({ status: 403 });
    }
    hasura.executeQuery.mockResolvedValue(stored('fast_delivery', 1));
    await expect(service.deleteConfiguration('cfg-1', 'user-1')).resolves.toBe(true);
    hasura.executeQuery.mockResolvedValue({ application_configurations_by_pk: null });
    await expect(service.deleteConfiguration('missing', 'user-1')).resolves.toBe(false);
    expect(rbac.hasRole).toHaveBeenCalledTimes(3);
  });
});

function stored(key: string, numberValue: number) {
  const row = { id: 'cfg-1', config_key: key, number_value: numberValue };
  return {
    application_configurations_by_pk: row,
    update_application_configurations_by_pk: row,
    delete_application_configurations_by_pk: { id: 'cfg-1' },
  };
}

function updatePayloads(hasura: { executeQuery: jest.Mock }): Array<{ number_value?: number }> {
  return hasura.executeQuery.mock.calls
    .filter((call) => String(call[0]).includes('UpdateConfiguration'))
    .map((call) => call[1].updates);
}

function graphqlUnique(): Error {
  const error = new Error('graphql');
  (error as { response?: unknown }).response = {
    errors: [{ message: 'Uniqueness violation. duplicate key value violates unique constraint' }],
  };
  return error;
}
