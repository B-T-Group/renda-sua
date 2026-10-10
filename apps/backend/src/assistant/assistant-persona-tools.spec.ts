import { AssistantToolsService } from './assistant-tools.service';
import type { AssistantIdentity } from './assistant.types';

describe('assistant persona tools', () => {
  const hasura = {
    executeQuery: jest.fn(),
    getAllUserAddresses: jest.fn(),
  };
  const marketsCatalog = {
    listCountryStates: jest.fn(),
    listPaymentSystems: jest.fn(),
  };
  const inventoryItems = { getInventorySearchSuggestions: jest.fn() };
  const appConfig = { getClientFlags: jest.fn() };
  const service = new AssistantToolsService(
    hasura as any,
    marketsCatalog as any,
    inventoryItems as any,
    appConfig as any
  );

  const guest: AssistantIdentity = {
    isVerified: false,
    userId: null,
    firstName: null,
    preferredLanguage: 'en',
    market: { country_code: 'CM' },
    country: 'CM',
    phoneE164: null,
    accountType: null,
    clientId: null,
  };

  const client: AssistantIdentity = {
    ...guest,
    isVerified: true,
    userId: 'u1',
    firstName: 'Ada',
    email: 'Ada@shop.test',
    phoneE164: '+237 699 001 234',
    accountType: 'client',
    clientId: 'c1',
    agentId: 'a-other',
    businessId: 'b-other',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    appConfig.getClientFlags.mockResolvedValue({ assistant_shopping_v1: false });
  });

  it('registers agent tools and withholds client order tools', async () => {
    const names = await toolNames(service, {
      ...client,
      accountType: 'agent',
      agentId: 'a1',
    });
    expect(names).toEqual(expect.arrayContaining([
      'get_my_active_deliveries',
      'get_my_earnings_summary',
      'get_my_agent_status',
      'get_my_wallet',
    ]));
    expect(names).not.toContain('get_my_recent_orders');
    expect(names).not.toContain('get_my_business_orders');
  });

  it('withholds agent and business tools from a client', async () => {
    const names = await toolNames(service, client);
    expect(names).not.toContain('get_my_active_deliveries');
    expect(names).not.toContain('get_my_business_orders');
    expect(names).toContain('get_my_recent_orders');
  });

  it('does not query private data for a guest', async () => {
    const orders = await service.executeTool({
      name: 'get_my_recent_orders',
      input: {},
      identity: guest,
    });
    const wallet = await service.executeTool({
      name: 'get_my_wallet',
      input: {},
      identity: guest,
    });
    const deliveries = await service.executeTool({
      name: 'get_my_active_deliveries',
      input: {},
      identity: guest,
    });

    expect(orders.content).toMatch(/No customer order profile/);
    expect(wallet.content).toBe('Authentication is required.');
    expect(deliveries.content).toBe('Authentication is required.');
    expect(hasura.executeQuery).not.toHaveBeenCalled();
    expect(hasura.getAllUserAddresses).not.toHaveBeenCalled();
  });

  it('does not read client orders for a business persona that also has a client id', async () => {
    const result = await service.executeTool({
      name: 'get_my_recent_orders',
      input: {},
      identity: { ...client, accountType: 'business', businessId: 'b1' },
    });
    expect(result.content).toMatch(/No customer order profile/);
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('does not read agent or business data for a client', async () => {
    const deliveries = await service.executeTool({
      name: 'get_my_active_deliveries',
      input: { agentId: 'a1' },
      identity: client,
    });
    const business = await service.executeTool({
      name: 'get_my_business_orders',
      input: { businessId: 'b1' },
      identity: client,
    });
    expect(deliveries.content).toMatch(/No agent profile/);
    expect(business.content).toMatch(/No business profile/);
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('does not read the wallet for a delegate', async () => {
    const result = await service.executeTool({
      name: 'get_my_wallet',
      input: {},
      identity: { ...client, accountType: 'delegate' },
    });
    expect(result.content).toMatch(/Delegate orders/);
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('looks up one order only for that client', async () => {
    hasura.executeQuery.mockResolvedValue({ orders: [] });
    const found = await service.executeTool({
      name: 'get_order_status',
      input: { order_number: '  RS-9  ' },
      identity: client,
    });
    const blank = await service.executeTool({
      name: 'get_order_status',
      input: { order_number: '   ' },
      identity: client,
    });

    expect(found.content).toBe('null');
    expect(hasura.executeQuery).toHaveBeenCalledTimes(1);
    const [query, vars] = hasura.executeQuery.mock.calls[0];
    expect(String(query)).toContain('client_id: { _eq: $clientId }');
    expect(String(query)).not.toMatch(/phone/i);
    expect(vars).toEqual({ clientId: 'c1', orderNumber: 'RS-9' });
    expect(blank.content).toMatch(/order number is required/i);
  });

  it('searches rentals in the identity market and ignores a country in the tool input', async () => {
    hasura.executeQuery.mockResolvedValue({
      rental_location_listings: [
        {
          id: 'rent-1',
          base_price_per_day: 5000,
          base_price_per_hour: 500,
          rental_item: { name: 'Drill', currency: 'XAF' },
        },
        {
          id: 'rent-2',
          base_price_per_hour: 800,
          rental_item: { name: 'Ladder', currency: 'XAF' },
        },
      ],
    });

    const result = await service.executeTool({
      name: 'search_rentals',
      input: { query: ' drill ', country_code: 'US' },
      identity: guest,
    });

    const [query, vars] = hasura.executeQuery.mock.calls[0];
    expect(String(query)).toContain('_ilike: $q');
    expect(vars).toEqual({ country: 'CM', q: '%drill%' });
    expect(result.cards).toEqual([
      expect.objectContaining({
        kind: 'rental',
        id: 'rent-1',
        title: 'Drill',
        priceLabel: '5000 XAF/day',
        href: '/rentals/rent-1',
      }),
      expect.objectContaining({
        id: 'rent-2',
        priceLabel: '800 XAF/hour',
      }),
    ]);
  });

  it('rejects a short public search and a missing market before querying', async () => {
    const short = await service.executeTool({
      name: 'search_restaurants',
      input: { query: ' a ' },
      identity: guest,
    });
    const noMarket = await service.executeTool({
      name: 'search_rentals',
      input: { query: 'drill' },
      identity: { ...guest, market: null },
    });
    expect(short.content).toMatch(/at least 2 characters/i);
    expect(noMarket.content).toMatch(/Market information is required/);
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('keeps one restaurant card per business and stops at six', async () => {
    const extras = Array.from({ length: 6 }, (_, index) => ({
      id: `loc-${index}`,
      name: `Counter ${index}`,
      business: { id: `biz-${index}`, name: `Shop ${index}` },
    }));
    hasura.executeQuery.mockResolvedValue({
      business_locations: [
        { id: 'loc-a', name: 'Alpha A', business: { id: 'biz-a', name: 'Alpha' } },
        { id: 'loc-b', name: 'Alpha B', business: { id: 'biz-a', name: 'Alpha' } },
        ...extras,
      ],
    });

    const result = await service.executeTool({
      name: 'search_restaurants',
      input: { query: 'riz', country: 'GA' },
      identity: guest,
    });

    expect(hasura.executeQuery.mock.calls[0][1]).toEqual({
      country: 'CM',
      q: '%riz%',
    });
    expect(result.cards).toHaveLength(6);
    expect(result.cards?.[0]).toMatchObject({
      kind: 'store',
      id: 'biz-a',
      title: 'Alpha',
      href: '/store/biz-a?menu=food',
    });
    expect(result.cards?.map((card) => card.id)).not.toContain('biz-5');
  });

  it('masks the profile and lists every enrolled persona', async () => {
    const result = await service.executeTool({
      name: 'get_my_profile_summary',
      input: {},
      identity: client,
    });
    expect(JSON.parse(result.content)).toMatchObject({
      firstName: 'Ada',
      activePersona: 'client',
      enrolledPersonas: ['client', 'agent', 'business'],
      phone: '••••34',
      email: 'A•••@shop.test',
    });
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('sums wallet balances by currency', async () => {
    hasura.executeQuery.mockResolvedValue({
      accounts: [
        { currency: 'XAF', available_balance: 100 },
        { currency: 'XAF', available_balance: 50.5 },
        { currency: 'CAD', available_balance: 2 },
        { currency: 'USD', available_balance: null },
      ],
    });
    const result = await service.executeTool({
      name: 'get_my_wallet',
      input: {},
      identity: client,
    });
    const json = result.content.slice(result.content.indexOf('['));
    expect(JSON.parse(json)).toEqual([
      { currency: 'XAF', available: 150.5 },
      { currency: 'CAD', available: 2 },
      { currency: 'USD', available: 0 },
    ]);
    expect(hasura.executeQuery.mock.calls[0][1]).toEqual({ userId: 'u1' });
  });

  it('returns at most ten addresses for the active persona', async () => {
    hasura.getAllUserAddresses.mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => ({ id: `addr-${index}` }))
    );
    const result = await service.executeTool({
      name: 'get_my_addresses',
      input: {},
      identity: client,
    });
    expect(hasura.getAllUserAddresses).toHaveBeenCalledWith('u1', 'client');
    expect(JSON.parse(result.content)).toHaveLength(10);
    expect(result.content).not.toContain('addr-10');
  });

  it('reads deliveries and earnings only for the signed-in agent', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('AssistantAgentEarnings')) {
        return { orders_aggregate: { aggregate: { count: 3 } } };
      }
      return {
        orders: [
          {
            id: 'ord-1',
            order_number: 'RS-1',
            current_status: 'in_transit',
            business: { name: 'Shop' },
          },
        ],
      };
    });
    const agent = { ...client, accountType: 'agent', agentId: 'a1', country: null };
    const deliveries = await service.executeTool({
      name: 'get_my_active_deliveries',
      input: {},
      identity: agent,
    });
    const earnings = await service.executeTool({
      name: 'get_my_earnings_summary',
      input: {},
      identity: agent,
    });
    const status = await service.executeTool({
      name: 'get_my_agent_status',
      input: {},
      identity: agent,
    });

    expect(deliveries.cards?.[0]).toMatchObject({ id: 'ord-1', href: '/orders/ord-1' });
    expect(hasura.executeQuery.mock.calls[0][1]).toEqual({ agentId: 'a1' });
    expect(String(hasura.executeQuery.mock.calls[0][0])).not.toMatch(/phone/i);
    expect(earnings.content).toContain('Completed deliveries: 3');
    expect(hasura.executeQuery.mock.calls[1][1]).toEqual({ agentId: 'a1' });
    expect(JSON.parse(status.content).openDeliveriesInMarket).toBeNull();
    expect(hasura.executeQuery.mock.calls.some(([query]) =>
      String(query).includes('AssistantOpenWork')
    )).toBe(false);
  });

  it('reads business orders for that business and omits customer phones', async () => {
    hasura.executeQuery.mockResolvedValue({
      orders: [
        {
          id: 'ord-9',
          order_number: 'RS-9',
          current_status: 'preparing',
          total_amount: 2500,
          currency: 'XAF',
          order_items: [{ item_name: 'Rice' }],
        },
      ],
    });
    const result = await service.executeTool({
      name: 'get_my_business_orders',
      input: { businessId: 'someone-else' },
      identity: { ...client, accountType: 'business', businessId: 'b1', clientId: 'c1' },
    });
    const [query, vars] = hasura.executeQuery.mock.calls[0];
    expect(vars).toEqual({ businessId: 'b1' });
    expect(String(query)).toContain('business_id: { _eq: $businessId }');
    expect(String(query)).not.toMatch(/phone/i);
    expect(result.cards?.[0]).toMatchObject({
      id: 'ord-9',
      title: 'Rice',
      priceLabel: '2500 XAF',
    });
  });
});

async function toolNames(
  service: AssistantToolsService,
  identity: AssistantIdentity
): Promise<string[]> {
  const config = await service.buildToolConfig(identity);
  return config.tools.map((tool) => tool.toolSpec?.name || '');
}
