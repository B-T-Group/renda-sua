import { ConfigurationsService } from './configurations.service';

describe('ConfigurationsService.getConfigurationByKey', () => {
  let service: ConfigurationsService;
  let executeQuery: jest.Mock;

  const configRow = {
    id: 'cfg-1',
    config_key: 'business_referral_payout_enabled',
    config_name: 'Referral payout enabled',
    data_type: 'boolean' as const,
    boolean_value: true,
    status: 'active' as const,
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    executeQuery = jest.fn().mockResolvedValue({
      application_configurations: [configRow],
    });
    service = new ConfigurationsService({ executeQuery } as any);
  });

  it('includes country_code when a country is provided', async () => {
    const result = await service.getConfigurationByKey('feature_flag', 'CA');

    expect(result).toEqual(configRow);
    expect(executeQuery).toHaveBeenCalledTimes(1);
    const [query, variables] = executeQuery.mock.calls[0];
    expect(String(query)).toContain('$country_code: String!');
    expect(String(query)).toContain('country_code: { _eq: $country_code }');
    expect(variables).toEqual({
      config_key: 'feature_flag',
      country_code: 'CA',
    });
  });

  it('omits country_code when country is missing or blank', async () => {
    await service.getConfigurationByKey('feature_flag');
    await service.getConfigurationByKey('feature_flag', '   ');

    expect(executeQuery).toHaveBeenCalledTimes(2);
    for (const [query, variables] of executeQuery.mock.calls) {
      expect(String(query)).not.toContain('$country_code');
      expect(String(query)).not.toContain('country_code: { _eq:');
      expect(variables).toEqual({ config_key: 'feature_flag' });
    }
  });

  it('trims country_code before querying', async () => {
    await service.getConfigurationByKey('feature_flag', '  GA  ');

    const [, variables] = executeQuery.mock.calls[0];
    expect(variables).toEqual({
      config_key: 'feature_flag',
      country_code: 'GA',
    });
  });

  it('returns null when no active configuration matches', async () => {
    executeQuery.mockResolvedValue({ application_configurations: [] });

    await expect(
      service.getConfigurationByKey('missing_key', 'CA')
    ).resolves.toBeNull();
  });
});
