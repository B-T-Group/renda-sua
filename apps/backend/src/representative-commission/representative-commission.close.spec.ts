import { RepresentativeCommissionService } from './representative-commission.service';

describe('RepresentativeCommissionService month close', () => {
  const hasura = { executeQuery: jest.fn() };
  const configurations = { getConfigurationByKey: jest.fn() };
  const grids = { loadFor: jest.fn() };
  const accounts = { registerDepositIfNotExists: jest.fn() };
  let service: RepresentativeCommissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RepresentativeCommissionService(
      hasura as never,
      configurations as never,
      grids as never,
      accounts as never
    );
    configurations.getConfigurationByKey.mockResolvedValue({
      boolean_value: false,
      status: 'active',
    });
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('PremiumCloseCandidates')) {
        return { agent_contracts: [{ agent_id: 'agent-1' }], agents: [], businesses: [] };
      }
      if (query.includes('PortfolioAgentCountry')) {
        return { agents_by_pk: { user: { country: 'CM' } } };
      }
      return {};
    });
  });

  it('does not close or pay while the portfolio flag is off', async () => {
    await expect(service.closePreviousMonth()).resolves.toBe(0);
    expect(accounts.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(hasura.executeQuery.mock.calls.some(([query]) =>
      String(query).includes('InsertPortfolioStatement')
    )).toBe(false);
    expect(hasura.executeQuery.mock.calls.some(([query]) =>
      String(query).includes('InsertPortfolioPremium')
    )).toBe(false);
  });

  it('does not replace 1% when the currency has no grid', async () => {
    configurations.getConfigurationByKey.mockResolvedValue({
      boolean_value: true,
      status: 'active',
    });
    grids.loadFor.mockResolvedValue(null);
    await expect(
      service.replacesLegacy('CA', 'CAD', new Date('2026-11-02T00:00:00.000+01:00'))
    ).resolves.toBe(false);
  });

  it('replaces 1% when the flag is on and a grid exists', async () => {
    configurations.getConfigurationByKey.mockResolvedValue({
      boolean_value: true,
      status: 'active',
    });
    grids.loadFor.mockResolvedValue({ id: 'grid-xaf' });
    await expect(
      service.replacesLegacy('CM', 'XAF', new Date('2026-11-02T00:00:00.000+01:00'))
    ).resolves.toBe(true);
  });
});
