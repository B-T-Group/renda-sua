import { GoogleDistanceService } from '../../google/google-distance.service';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { DeliveryUnavailableReason } from '../delivery-availability.types';
import { ItemMaxDeliveryDistanceRule } from './item-max-delivery-distance.rule';

describe('ItemMaxDeliveryDistanceRule', () => {
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let googleDistanceService: jest.Mocked<GoogleDistanceService>;
  let rule: ItemMaxDeliveryDistanceRule;

  // Douala-ish pickup; ~0.09 deg latitude ≈ 10 km.
  const baseCtx = {
    businessId: 'biz-1',
    sellerCountry: 'CM',
    sellerState: 'Littoral',
    pickupLat: 4.05,
    pickupLon: 9.7,
    deliveryLat: 4.14, // ~10 km north
    deliveryLon: 9.7,
    itemIds: ['item-1', 'item-2'],
    evaluatedAt: new Date(),
  };

  beforeEach(() => {
    hasuraSystemService = {
      executeQuery: jest.fn(),
    } as unknown as jest.Mocked<HasuraSystemService>;
    googleDistanceService = {
      geocode: jest.fn(),
    } as unknown as jest.Mocked<GoogleDistanceService>;
    rule = new ItemMaxDeliveryDistanceRule(
      hasuraSystemService,
      googleDistanceService
    );
  });

  function mockQueries(options: {
    items: Array<{ id: string; max_delivery_distance: number | string | null }>;
    address?: Record<string, unknown> | null;
  }) {
    (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
      (query: string) => {
        if (query.includes('ItemMaxDeliveryDistances')) {
          return Promise.resolve({ items: options.items });
        }
        if (query.includes('AddressForGeocode')) {
          return Promise.resolve({ addresses_by_pk: options.address ?? null });
        }
        return Promise.resolve({});
      }
    );
  }

  it('passes when the client is within every item limit', async () => {
    mockQueries({
      items: [
        { id: 'item-1', max_delivery_distance: 50 },
        { id: 'item-2', max_delivery_distance: 30 },
      ],
    });

    const outcome = await rule.evaluate(baseCtx);

    expect(outcome.pass).toBe(true);
  });

  it('fails with DELIVERY_RADIUS_EXCEEDED when the strictest item limit is exceeded', async () => {
    mockQueries({
      items: [
        { id: 'item-1', max_delivery_distance: 50 },
        { id: 'item-2', max_delivery_distance: 5 },
      ],
    });

    const outcome = await rule.evaluate(baseCtx);

    expect(outcome.pass).toBe(false);
    if (!outcome.pass) {
      expect(outcome.reason).toBe(
        DeliveryUnavailableReason.DELIVERY_RADIUS_EXCEEDED
      );
      expect(outcome.metadata?.limitingItemId).toBe('item-2');
    }
  });

  it('ignores items without a positive max_delivery_distance', async () => {
    mockQueries({
      items: [
        { id: 'item-1', max_delivery_distance: null },
        { id: 'item-2', max_delivery_distance: 0 },
      ],
    });

    const outcome = await rule.evaluate(baseCtx);

    expect(outcome.pass).toBe(true);
  });

  it('passes when no address has been chosen yet (delivery location unknown)', async () => {
    mockQueries({
      items: [{ id: 'item-1', max_delivery_distance: 5 }],
    });

    const outcome = await rule.evaluate({
      ...baseCtx,
      deliveryLat: null,
      deliveryLon: null,
    });

    expect(outcome.pass).toBe(true);
    expect(googleDistanceService.geocode).not.toHaveBeenCalled();
  });

  it('uses stored address coordinates when the context has none', async () => {
    mockQueries({
      items: [{ id: 'item-1', max_delivery_distance: 5 }],
      address: { latitude: 4.14, longitude: 9.7 },
    });

    const outcome = await rule.evaluate({
      ...baseCtx,
      deliveryLat: null,
      deliveryLon: null,
      deliveryAddressId: 'addr-1',
    });

    expect(outcome.pass).toBe(false);
    expect(googleDistanceService.geocode).not.toHaveBeenCalled();
  });

  it('geocodes the address when it has no stored coordinates', async () => {
    mockQueries({
      items: [{ id: 'item-1', max_delivery_distance: 5 }],
      address: {
        address_line_1: '123 Rue',
        city: 'Douala',
        state: 'Littoral',
        postal_code: '',
        country: 'CM',
        latitude: null,
        longitude: null,
      },
    });
    (googleDistanceService.geocode as jest.Mock).mockResolvedValue({
      latitude: 4.14,
      longitude: 9.7,
    });

    const outcome = await rule.evaluate({
      ...baseCtx,
      deliveryLat: null,
      deliveryLon: null,
      deliveryAddressId: 'addr-1',
    });

    expect(googleDistanceService.geocode).toHaveBeenCalledWith(
      '123 Rue, Douala, Littoral, CM'
    );
    expect(outcome.pass).toBe(false);
  });

  it('passes when the address cannot be geocoded', async () => {
    mockQueries({
      items: [{ id: 'item-1', max_delivery_distance: 5 }],
      address: {
        address_line_1: 'Unknown',
        city: '',
        state: '',
        postal_code: '',
        country: '',
        latitude: null,
        longitude: null,
      },
    });
    (googleDistanceService.geocode as jest.Mock).mockResolvedValue(null);

    const outcome = await rule.evaluate({
      ...baseCtx,
      deliveryLat: null,
      deliveryLon: null,
      deliveryAddressId: 'addr-1',
    });

    expect(outcome.pass).toBe(true);
  });

  it('passes without querying when there are no item ids', async () => {
    const outcome = await rule.evaluate({ ...baseCtx, itemIds: [] });

    expect(outcome.pass).toBe(true);
    expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
  });
});
