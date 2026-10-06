import { AssistantToolsService } from './assistant-tools.service';
import type { AssistantIdentity } from './assistant.types';

describe('AssistantToolsService', () => {
  const hasura = { executeQuery: jest.fn(), getAllUserAddresses: jest.fn() };
  const marketsCatalog = {
    listCountryStates: jest.fn(),
    listPaymentSystems: jest.fn(),
  };
  const inventoryItems = {
    getInventorySearchSuggestions: jest.fn(),
  };
  const appConfig = {
    getClientFlags: jest.fn(),
  };
  const service = new AssistantToolsService(
    hasura as any,
    marketsCatalog as any,
    inventoryItems as any,
    appConfig as any
  );

  const anonymous: AssistantIdentity = {
    isVerified: false,
    userId: null,
    firstName: null,
    preferredLanguage: null,
    market: { country_code: 'GA' },
    country: 'GA',
    phoneE164: '2416000000',
    accountType: null,
    clientId: null,
  };

  const verified: AssistantIdentity = {
    ...anonymous,
    isVerified: true,
    userId: 'u1',
    firstName: 'Ada',
    accountType: 'client',
    clientId: 'c1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    appConfig.getClientFlags.mockResolvedValue({
      assistant_shopping_v1: false,
    });
  });

  it('exposes knowledge, catalog, and handoff tools for anonymous users', async () => {
    const config = await service.buildToolConfig(anonymous);
    const tools = config.tools.map((t) => t.toolSpec?.name);
    expect(tools).toEqual([
      'get_knowledge',
      'list_supported_country_states',
      'list_supported_payment_systems',
      'request_human_support',
    ]);
  });

  it('adds order tools when the user has a client profile', async () => {
    const config = await service.buildToolConfig(verified);
    const clientTools = config.tools.map((t) => t.toolSpec?.name);
    expect(clientTools).toContain('get_my_recent_orders');
    expect(clientTools).toContain('get_order_status');

    const businessWithClientConfig = await service.buildToolConfig({
      ...verified,
      accountType: 'business',
      clientId: 'c1',
    });
    const businessWithClient = businessWithClientConfig.tools.map(
      (t) => t.toolSpec?.name
    );
    expect(businessWithClient).toContain('get_my_recent_orders');

    const businessOnlyConfig = await service.buildToolConfig({
      ...verified,
      accountType: 'business',
      clientId: null,
    });
    const businessOnly = businessOnlyConfig.tools.map((t) => t.toolSpec?.name);
    expect(businessOnly).not.toContain('get_my_recent_orders');
    expect(businessOnly).not.toContain('get_order_status');
    expect(businessOnly).toContain('get_my_addresses');
    expect(businessOnly).toContain('get_my_profile_summary');
  });

  it('adds user-scoped tools for verified clients', async () => {
    const config = await service.buildToolConfig(verified);
    const tools = config.tools.map((t) => t.toolSpec?.name);
    expect(tools).toContain('get_my_recent_orders');
    expect(tools).toContain('get_order_status');
    expect(tools).toContain('get_my_addresses');
    expect(tools).toContain('get_my_profile_summary');
  });

  it('returns curated knowledge for payments', async () => {
    const result = await service.executeTool({
      name: 'get_knowledge',
      input: { topic: 'payments', country: 'CM' },
      identity: anonymous,
      locale: 'en',
    });
    expect(result.content).toMatch(/MTN Mobile Money/i);
    expect(result.content).toMatch(/Cameroon/i);
  });

  it('queries live country states via the catalog service', async () => {
    marketsCatalog.listCountryStates.mockResolvedValue('CM configured');
    const result = await service.executeTool({
      name: 'list_supported_country_states',
      input: { country_code: 'BR' },
      identity: anonymous,
      locale: 'en',
    });
    expect(marketsCatalog.listCountryStates).toHaveBeenCalledWith('BR');
    expect(result.content).toBe('CM configured');
  });

  it('queries live payment systems via the catalog service', async () => {
    marketsCatalog.listPaymentSystems.mockResolvedValue('no payments for BR');
    const result = await service.executeTool({
      name: 'list_supported_payment_systems',
      input: { country_code: 'BR' },
      identity: anonymous,
      locale: 'en',
    });
    expect(marketsCatalog.listPaymentSystems).toHaveBeenCalledWith('BR');
    expect(result.content).toMatch(/no payments for BR/i);
  });

  it('marks human support as handoff', async () => {
    const result = await service.executeTool({
      name: 'request_human_support',
      input: { reason: 'unknown', issue_type: 'no_answer' },
      identity: anonymous,
      locale: 'en',
    });
    expect(result.handoff).toBe(true);
    expect(result.content).toMatch(/\[\[NO_REPLY\]\]/);
    expect(result.content).toMatch(/get back shortly/i);
  });

  describe('shopping tools (assistant_shopping_v1 flag)', () => {
    it('includes search_catalog when flag is enabled', async () => {
      appConfig.getClientFlags.mockResolvedValue({
        assistant_shopping_v1: true,
      });
      const config = await service.buildToolConfig(anonymous);
      const tools = config.tools.map((t) => t.toolSpec?.name);
      expect(tools).toContain('search_catalog');
      expect(appConfig.getClientFlags).toHaveBeenCalledWith('GA');
    });

    it('excludes search_catalog when flag is disabled', async () => {
      appConfig.getClientFlags.mockResolvedValue({
        assistant_shopping_v1: false,
      });
      const config = await service.buildToolConfig(anonymous);
      const tools = config.tools.map((t) => t.toolSpec?.name);
      expect(tools).not.toContain('search_catalog');
    });

    it('handles flag check failure gracefully', async () => {
      appConfig.getClientFlags.mockRejectedValue(new Error('DB down'));
      const config = await service.buildToolConfig(anonymous);
      const tools = config.tools.map((t) => t.toolSpec?.name);
      expect(tools).not.toContain('search_catalog');
    });

    it('searches catalog with market scope and returns formatted results', async () => {
      inventoryItems.getInventorySearchSuggestions.mockResolvedValue([
        { kind: 'term', value: 'phone' },
        {
          kind: 'product',
          inventoryId: 'item-1',
          title: 'Samsung Galaxy',
          price: 150000,
          currency: 'XAF',
        },
        { kind: 'category', value: 'Electronics' },
      ]);

      const result = await service.executeTool({
        name: 'search_catalog',
        input: { query: 'phone' },
        identity: { ...anonymous, market: { country_code: 'CM', state: 'Littoral' } },
        locale: 'en',
      });

      expect(inventoryItems.getInventorySearchSuggestions).toHaveBeenCalledWith({
        q: 'phone',
        country_code: 'CM',
        is_active: true,
        include_unavailable: false,
      });
      expect(result.content).toContain('Samsung Galaxy');
      expect(result.content).toContain('/inventory/item-1');
      expect(result.content).toContain('150000 XAF');
      expect(result.content).toContain('Electronics');
    });

    it('requires market for catalog search', async () => {
      const result = await service.executeTool({
        name: 'search_catalog',
        input: { query: 'phone' },
        identity: { ...anonymous, market: null },
        locale: 'en',
      });
      expect(result.content).toMatch(/market information is required/i);
      expect(inventoryItems.getInventorySearchSuggestions).not.toHaveBeenCalled();
    });

    it('handles empty search results gracefully', async () => {
      inventoryItems.getInventorySearchSuggestions.mockResolvedValue([]);
      const result = await service.executeTool({
        name: 'search_catalog',
        input: { query: 'xyzabc' },
        identity: { ...anonymous, market: { country_code: 'CM' } },
        locale: 'en',
      });
      expect(result.content).toMatch(/no products found/i);
      expect(result.content).toContain('xyzabc');
      expect(result.content).toContain('CM');
    });

    it('handles search API failures gracefully', async () => {
      inventoryItems.getInventorySearchSuggestions.mockRejectedValue(
        new Error('Hasura timeout')
      );
      const result = await service.executeTool({
        name: 'search_catalog',
        input: { query: 'phone' },
        identity: { ...anonymous, market: { country_code: 'CM' } },
        locale: 'en',
      });
      expect(result.content).toMatch(/unable to search/i);
    });
  });
});
