import { ConfigService } from '@nestjs/config';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { FacebookCatalogFeedService } from './facebook-catalog-feed.service';

describe('FacebookCatalogFeedService', () => {
  let service: FacebookCatalogFeedService;
  let hasura: { executeQuery: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'publicWebAppUrl') return 'https://rendasua.com';
        return undefined;
      }),
    };
    service = new FacebookCatalogFeedService(
      hasura as unknown as HasuraSystemService,
      config as unknown as ConfigService
    );
  });

  it('filters to payments-enabled locations and builds CSV', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        supported_payment_systems: [{ country: 'CA' }],
      })
      .mockResolvedValueOnce({
        business_inventory: [
          {
            id: 'inv-momo-ok',
            selling_price: 1000,
            computed_available_quantity: 2,
            is_active: true,
            item: {
              name: 'Ok Item',
              description: 'desc',
              price: 1000,
              currency: 'XAF',
              is_used: false,
              brand: { name: 'Brand' },
              item_images: [],
              item_tags: [],
              item_sub_category: null,
            },
            business_location: {
              name: 'Yaounde',
              mobile_payment_phone: { is_verified: true },
              address: { country: 'CM' },
              business: { name: 'Biz' },
            },
          },
          {
            id: 'inv-blocked',
            selling_price: 500,
            computed_available_quantity: 1,
            is_active: true,
            item: {
              name: 'Blocked',
              description: 'no pay',
              price: 500,
              currency: 'XAF',
              is_used: false,
              brand: null,
              item_images: [],
              item_tags: [],
              item_sub_category: null,
            },
            business_location: {
              name: 'Douala',
              mobile_payment_phone: { is_verified: false },
              address: { country: 'CM' },
              business: { name: 'Biz2' },
            },
          },
          {
            id: 'inv-stripe',
            selling_price: 20,
            computed_available_quantity: 1,
            is_active: true,
            item: {
              name: 'Stripe Item',
              description: 'ca',
              price: 20,
              currency: 'CAD',
              is_used: false,
              brand: null,
              item_images: [],
              item_tags: [],
              item_sub_category: null,
            },
            business_location: {
              name: 'Toronto',
              mobile_payment_phone: null,
              address: { country: 'CA' },
              business: { name: 'CA Biz' },
            },
          },
        ],
      });

    const { csv, rowCount } = await service.buildCsv();
    expect(rowCount).toBe(2);
    expect(csv).toContain('inv-momo-ok');
    expect(csv).toContain('inv-stripe');
    expect(csv).not.toContain('inv-blocked');
    expect(csv).toContain('1000 XAF');
    expect(csv).toContain('20 CAD');
    expect(csv).toContain('https://rendasua.com/items/inv-momo-ok');
  });

  it('paginates until a short page', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      supported_payment_systems: [{ country: 'CA' }],
    });

    const makeRow = (id: string) => ({
      id,
      selling_price: 1,
      computed_available_quantity: 1,
      is_active: true,
      item: {
        name: id,
        description: '',
        price: 1,
        currency: 'XAF',
        is_used: false,
        brand: null,
        item_images: [],
        item_tags: [],
        item_sub_category: null,
      },
      business_location: {
        name: 'Loc',
        mobile_payment_phone: { is_verified: true },
        address: { country: 'CM' },
        business: { name: 'B' },
      },
    });

    const page1 = Array.from({ length: 500 }, (_, i) =>
      makeRow(`inv-${i}`)
    );
    const page2 = [makeRow('inv-last')];
    hasura.executeQuery
      .mockResolvedValueOnce({ business_inventory: page1 })
      .mockResolvedValueOnce({ business_inventory: page2 });

    const { rowCount } = await service.buildCsv();
    expect(rowCount).toBe(501);
    expect(hasura.executeQuery).toHaveBeenCalledTimes(3);
  });
});
