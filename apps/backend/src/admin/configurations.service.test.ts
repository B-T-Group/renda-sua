import { ConfigurationsService } from '../admin/configurations.service';

describe('ConfigurationsService', () => {
  let service: ConfigurationsService;
  let hasura: { executeQuery: jest.Mock };

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    service = new ConfigurationsService(hasura as any);
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

  it('returns null when no active configuration exists', async () => {
    hasura.executeQuery.mockResolvedValue({ application_configurations: [] });

    await expect(service.getConfigurationByKey('missing')).resolves.toBeNull();
  });
});
