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
});
