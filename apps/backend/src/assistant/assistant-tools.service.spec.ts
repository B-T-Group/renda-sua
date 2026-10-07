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

  it('adds search_catalog tool when assistant_shopping_v1 is enabled', async () => {
    appConfig.getClientFlags.mockResolvedValue({
      assistant_shopping_v1: true,
    });
    const config = await service.buildToolConfig(anonymous);
    const tools = config.tools.map((t) => t.toolSpec?.name);
    expect(tools).toContain('search_catalog');
  });

  it('omits search_catalog tool when flag is off', async () => {
    appConfig.getClientFlags.mockResolvedValue({
      assistant_shopping_v1: false,
    });
    const config = await service.buildToolConfig(anonymous);
    const tools = config.tools.map((t) => t.toolSpec?.name);
    expect(tools).not.toContain('search_catalog');
  });

  it('search_catalog builds correct /items/:id routes', async () => {
    process.env.FRONTEND_URL = 'https://test.rendasua.com';
    inventoryItems.getInventorySearchSuggestions.mockResolvedValue([
      {
        kind: 'product',
        inventoryId: 'inv-123',
        title: 'Test Phone',
        price: 50000,
        currency: 'XAF',
        available: true,
      },
    ]);

    const result = await service.executeTool({
      name: 'search_catalog',
      input: { query: 'phone' },
      identity: { ...anonymous, market: { country_code: 'CM' } },
      locale: 'en',
    });

    expect(result.content).toContain('https://test.rendasua.com/items/inv-123');
    expect(result.content).not.toContain('/inventory/');
    delete process.env.FRONTEND_URL;
  });

  it('search_catalog builds correct search results link', async () => {
    process.env.FRONTEND_URL = 'https://test.rendasua.com';
    inventoryItems.getInventorySearchSuggestions.mockResolvedValue([
      {
        kind: 'product',
        inventoryId: 'inv-123',
        title: 'Test Phone',
        price: 50000,
        currency: 'XAF',
      },
    ]);

    const result = await service.executeTool({
      name: 'search_catalog',
      input: { query: 'phone case' },
      identity: { ...anonymous, market: { country_code: 'CM' } },
      locale: 'en',
    });

    expect(result.content).toContain('https://test.rendasua.com/items?search=phone%20case');
    expect(result.content).not.toContain('/shop?q=');
    delete process.env.FRONTEND_URL;
  });

  it('search_catalog uses production URL by default', async () => {
    delete process.env.FRONTEND_URL;
    inventoryItems.getInventorySearchSuggestions.mockResolvedValue([
      {
        kind: 'product',
        inventoryId: 'inv-123',
        title: 'Test Phone',
        price: 50000,
        currency: 'XAF',
      },
    ]);

    const result = await service.executeTool({
      name: 'search_catalog',
      input: { query: 'phone' },
      identity: { ...anonymous, market: { country_code: 'CM' } },
      locale: 'en',
    });

    expect(result.content).toContain('https://rendasua.com/items/inv-123');
  });

  it('search_catalog shows availability when provided', async () => {
    inventoryItems.getInventorySearchSuggestions.mockResolvedValue([
      {
        kind: 'product',
        inventoryId: 'inv-123',
        title: 'Available Item',
        price: 5000,
        currency: 'XAF',
        available: true,
      },
      {
        kind: 'product',
        inventoryId: 'inv-456',
        title: 'Out of Stock Item',
        price: 10000,
        currency: 'XAF',
        available: false,
      },
    ]);

    const result = await service.executeTool({
      name: 'search_catalog',
      input: { query: 'items' },
      identity: { ...anonymous, market: { country_code: 'CM' } },
      locale: 'en',
    });

    expect(result.content).toContain('Available Item');
    expect(result.content).not.toContain('Available Item] (currently unavailable)');
    expect(result.content).toContain('Out of Stock Item');
    expect(result.content).toContain('(currently unavailable)');
  });

  it('search_catalog shows price with currency when both present', async () => {
    inventoryItems.getInventorySearchSuggestions.mockResolvedValue([
      {
        kind: 'product',
        inventoryId: 'inv-123',
        title: 'Phone XAF',
        price: 50000,
        currency: 'XAF',
      },
      {
        kind: 'product',
        inventoryId: 'inv-456',
        title: 'Phone CAD',
        price: 100,
        currency: 'CAD',
      },
      {
        kind: 'product',
        inventoryId: 'inv-789',
        title: 'Phone No Currency',
        price: 200,
        currency: null,
      },
    ]);

    const result = await service.executeTool({
      name: 'search_catalog',
      input: { query: 'phone' },
      identity: { ...anonymous, market: { country_code: 'CM' } },
      locale: 'en',
    });

    expect(result.content).toContain('Phone XAF') && expect(result.content).toContain('50000 XAF');
    expect(result.content).toContain('Phone CAD') && expect(result.content).toContain('100 CAD');
    expect(result.content).toContain('Phone No Currency');
    expect(result.content).not.toContain('200 null');
  });

  it('search_catalog requires market context', async () => {
    const result = await service.executeTool({
      name: 'search_catalog',
      input: { query: 'phone' },
      identity: { ...anonymous, market: null },
      locale: 'en',
    });

    expect(result.content).toContain('Market information is required');
    expect(inventoryItems.getInventorySearchSuggestions).not.toHaveBeenCalled();
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

  describe('reorder tools', () => {
    it('adds get_reorder_options tool for clients', async () => {
      const config = await service.buildToolConfig(verified);
      const tools = config.tools.map((t) => t.toolSpec?.name);
      expect(tools).toContain('get_reorder_options');
    });

    it('omits get_reorder_options for users without client profile', async () => {
      const config = await service.buildToolConfig({
        ...verified,
        clientId: null,
      });
      const tools = config.tools.map((t) => t.toolSpec?.name);
      expect(tools).not.toContain('get_reorder_options');
    });

    it('returns reorder options with deep links', async () => {
      process.env.FRONTEND_URL = 'https://test.rendasua.com';
      hasura.executeQuery.mockResolvedValue({
        orders: [
          {
            id: 'order-123',
            order_number: 'ORD-001',
            current_status: 'complete',
            total_amount: 15000,
            currency: 'XAF',
            created_at: '2026-10-01T10:00:00Z',
            business: { id: 'biz-1', name: 'Test Store' },
          },
          {
            id: 'order-456',
            order_number: 'ORD-002',
            current_status: 'delivered',
            total_amount: 25000,
            currency: 'XAF',
            created_at: '2026-09-28T15:30:00Z',
            business: { id: 'biz-2', name: 'Another Store' },
          },
        ],
      });

      const result = await service.executeTool({
        name: 'get_reorder_options',
        input: {},
        identity: verified,
        locale: 'en',
      });

      expect(result.content).toContain('Recent orders you can reorder');
      expect(result.content).toContain('Test Store');
      expect(result.content).toContain('15000 XAF');
      expect(result.content).toContain('https://test.rendasua.com/orders/order-123/reorder');
      expect(result.content).toContain('[Reorder]');
      expect(result.content).toContain('Another Store');
      expect(result.content).toContain('25000 XAF');
      delete process.env.FRONTEND_URL;
    });

    it('handles no completed orders for reorder', async () => {
      hasura.executeQuery.mockResolvedValue({ orders: [] });

      const result = await service.executeTool({
        name: 'get_reorder_options',
        input: {},
        identity: verified,
        locale: 'en',
      });

      expect(result.content).toContain('No recent completed orders found');
      expect(result.content).toContain('not placed any orders yet');
    });

    it('requires client profile for reorder options', async () => {
      const result = await service.executeTool({
        name: 'get_reorder_options',
        input: {},
        identity: { ...verified, clientId: null },
        locale: 'en',
      });

      expect(result.content).toContain('No customer order profile');
      expect(hasura.executeQuery).not.toHaveBeenCalled();
    });
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
      expect(result.content).toContain('/items/item-1');
      expect(result.content).not.toContain('/inventory/');
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
