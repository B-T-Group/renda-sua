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

  it('returns null when no active configuration exists', async () => {
    hasura.executeQuery.mockResolvedValue({ application_configurations: [] });

    await expect(service.getConfigurationByKey('missing')).resolves.toBeNull();
  });
});
