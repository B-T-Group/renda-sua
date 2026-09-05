import { AssistantMarketsCatalogService } from './assistant-markets-catalog.service';

describe('AssistantMarketsCatalogService', () => {
  const hasura = { executeQuery: jest.fn() };
  const service = new AssistantMarketsCatalogService(hasura as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats country states grouped by country', async () => {
    hasura.executeQuery.mockResolvedValue({
      supported_country_states: [
        {
          country_code: 'CM',
          country_name: 'Cameroon',
          currency_code: 'XAF',
          service_status: 'active',
          delivery_enabled: true,
          state_name: 'Littoral',
        },
        {
          country_code: 'CM',
          country_name: 'Cameroon',
          currency_code: 'XAF',
          service_status: 'active',
          delivery_enabled: true,
          state_name: 'Centre',
        },
      ],
    });
    const text = await service.listCountryStates('CM');
    expect(text).toMatch(/CM \(Cameroon\)/);
    expect(text).toMatch(/Littoral/);
    expect(text).toMatch(/Centre/);
    expect(text).toMatch(/not available/i);
  });

  it('formats payment systems with customer-facing labels', async () => {
    hasura.executeQuery.mockResolvedValue({
      supported_payment_systems: [
        { name: 'freemopay', country: 'CM' },
        { name: 'stripe', country: 'CA' },
      ],
    });
    const text = await service.listPaymentSystems();
    expect(text).toMatch(/CM:.*MTN \/ Orange/i);
    expect(text).toMatch(/CA:.*stripe \(card payments\)/i);
    expect(text).toMatch(/Pix/i);
  });

  it('explains missing country payment systems', async () => {
    hasura.executeQuery.mockResolvedValue({ supported_payment_systems: [] });
    const text = await service.listPaymentSystems('BR');
    expect(text).toMatch(/No active payment systems found for BR/i);
  });
});
