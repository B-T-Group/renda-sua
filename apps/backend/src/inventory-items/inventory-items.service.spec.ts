import { InventoryItemsService } from './inventory-items.service';

describe('InventoryItemsService.buildInventoryCatalogWhere', () => {
  function createService(options?: {
    validateLocationSupport?: boolean;
    supportedCountries?: string[];
  }) {
    const hasuraSystemService = {
      executeQuery: jest.fn().mockImplementation(async (query: string) => {
        if (query.includes('ValidateLocationSupport')) {
          return {
            supported_country_states: options?.validateLocationSupport === false ? [] : [{ id: '1' }],
          };
        }
        if (query.includes('GetSupportedCountryCodes')) {
          return {
            supported_country_states: (options?.supportedCountries ?? ['CA', 'CM']).map(
              (country_code) => ({ country_code })
            ),
          };
        }
        if (query.includes('StripeCountries')) {
          return {
            supported_payment_systems: [{ country: 'CA' }],
          };
        }
        return {};
      }),
    };

    const service = new InventoryItemsService(
      hasuraSystemService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    return {
      service,
      buildWhere: (params: Record<string, unknown>) =>
        (service as any).buildInventoryCatalogWhere({
          is_active: true,
          include_unavailable: false,
          ...params,
        }),
      whereJson: (result: { where: Record<string, unknown> }) =>
        JSON.stringify(result.where),
    };
  }

  function hasCountryEq(whereJson: string, country: string): boolean {
    return whereJson.includes(`"country":{"_eq":"${country}"}`);
  }

  it('skips caller geo when business_location_id is set', async () => {
    const { buildWhere, whereJson } = createService();
    const built = await buildWhere({
      business_location_id: 'loc-cm-1',
      country_code: 'CA',
      state: 'Ontario',
    });

    expect(built).toHaveProperty('where');
    const json = whereJson(built as { where: Record<string, unknown> });
    expect(json).toContain('"business_location_id":{"_eq":"loc-cm-1"}');
    expect(hasCountryEq(json, 'CA')).toBe(false);
    expect(json).not.toContain('"state":{"_eq":"Ontario"}');
  });

  it('applies caller geo when browsing without business_location_id', async () => {
    const { buildWhere, whereJson } = createService();
    const built = await buildWhere({
      country_code: 'CA',
      state: 'Ontario',
    });

    expect(built).toHaveProperty('where');
    const json = whereJson(built as { where: Record<string, unknown> });
    expect(hasCountryEq(json, 'CA')).toBe(true);
    expect(json).toContain('"state":{"_eq":"Ontario"}');
  });

  it('skips caller geo for owner preview even without business_location_id', async () => {
    const { buildWhere, whereJson } = createService();
    const built = await buildWhere({
      country_code: 'CA',
      ownerPreview: true,
    });

    expect(built).toHaveProperty('where');
    const json = whereJson(built as { where: Record<string, unknown> });
    expect(hasCountryEq(json, 'CA')).toBe(false);
  });
});
