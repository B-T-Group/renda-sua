import { AssistantToolsService } from './assistant-tools.service';
import type { AssistantIdentity } from './assistant.types';

describe('assistant rental tool registration', () => {
  const hasura = { executeQuery: jest.fn() };
  const marketsCatalog = { listCountryStates: jest.fn(), listPaymentSystems: jest.fn() };
  const inventoryItems = { getInventorySearchSuggestions: jest.fn() };
  const appConfig = { getClientFlags: jest.fn() };
  const rentals = {
    enabled: jest.fn(),
    handles: (name: string) =>
      name === 'search_rentals' || name === 'quote_rental' || name === 'get_rental_listing_details',
    toolSpecs: () => [
      { toolSpec: { name: 'search_rentals' } },
      { toolSpec: { name: 'get_rental_listing_details' } },
      { toolSpec: { name: 'quote_rental' } },
    ],
    run: jest.fn(),
  };
  const identity: AssistantIdentity = {
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

  beforeEach(() => {
    jest.clearAllMocks();
    appConfig.getClientFlags.mockResolvedValue({ assistant_shopping_v1: false, assistant_rentals_enabled: false });
  });

  function service(withRentals: boolean) {
    return new AssistantToolsService(
      hasura as any,
      marketsCatalog as any,
      inventoryItems as any,
      appConfig as any,
      withRentals ? (rentals as any) : undefined
    );
  }

  it('keeps the name-only rental search when the flag is off', async () => {
    rentals.enabled.mockResolvedValue(false);
    const names = await namesOf(service(true), identity, 'app');
    expect(names.filter((name) => name === 'search_rentals')).toHaveLength(1);
    expect(names).not.toContain('quote_rental');
    expect(names).not.toContain('create_rental_request');
  });

  it('registers the read-only rental tools in the app and not on WhatsApp', async () => {
    rentals.enabled.mockResolvedValue(true);
    const app = await namesOf(service(true), identity, 'app');
    expect(app.filter((name) => name === 'search_rentals')).toHaveLength(1);
    expect(app).toEqual(expect.arrayContaining(['quote_rental', 'get_rental_listing_details']));
    expect(app).not.toContain('create_rental_request');
    const whatsapp = await namesOf(service(true), identity, 'whatsapp');
    expect(whatsapp).not.toContain('quote_rental');
  });
});

async function namesOf(
  service: AssistantToolsService,
  identity: AssistantIdentity,
  channel: 'app' | 'whatsapp'
) {
  const config = await service.buildToolConfig(identity, channel);
  return (config.tools || []).map((tool) => tool.toolSpec?.name);
}
