import { ConfigurationsService } from '../admin/configurations.service';
import { flagReader, readPortfolioEnabled } from './portfolio-commission-flag';

/** QA #559 F3: the fallback must be the country_code IS NULL row, never an arbitrary one. */
describe('portfolio flag global fallback (F3)', () => {
  const on = { boolean_value: true, status: 'active' };

  it('CA agent with only a CM row and no global row reads OFF', async () => {
    const configs = {
      getConfigurationByKey: jest.fn(async (_k: string, country?: string) =>
        country === 'CM' ? on : null
      ),
      getGlobalConfigurationByKey: jest.fn(async () => null),
    };

    await expect(readPortfolioEnabled(flagReader(configs), 'CA')).resolves.toBe(false);
    expect(configs.getConfigurationByKey).toHaveBeenCalledWith(
      'representative_portfolio_commission_enabled',
      'CA'
    );
    expect(configs.getConfigurationByKey).not.toHaveBeenCalledWith(
      'representative_portfolio_commission_enabled',
      undefined
    );
    expect(configs.getGlobalConfigurationByKey).toHaveBeenCalledTimes(1);
  });

  it('uses the global row when the country has none', async () => {
    const configs = {
      getConfigurationByKey: jest.fn(async () => null),
      getGlobalConfigurationByKey: jest.fn(async () => on),
    };
    await expect(readPortfolioEnabled(flagReader(configs), 'CA')).resolves.toBe(true);
  });

  it('agent without a country reads only the global row', async () => {
    const configs = {
      getConfigurationByKey: jest.fn(async () => on),
      getGlobalConfigurationByKey: jest.fn(async () => null),
    };
    await expect(readPortfolioEnabled(flagReader(configs), null)).resolves.toBe(false);
    expect(configs.getConfigurationByKey).not.toHaveBeenCalled();
  });

  it('getGlobalConfigurationByKey filters on country_code IS NULL', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({ application_configurations: [on] }),
    };
    const service = Object.create(ConfigurationsService.prototype);
    service.hasuraService = hasura;

    await expect(service.getGlobalConfigurationByKey('k')).resolves.toBe(on);
    const query = hasura.executeQuery.mock.calls[0][0] as string;
    expect(query).toContain('country_code: { _is_null: true }');
    expect(query).toContain('status: { _eq: "active" }');
    expect(hasura.executeQuery.mock.calls[0][1]).toEqual({ config_key: 'k' });
  });
});
