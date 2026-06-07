import { webcrypto } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { InventoryItemsService } from '../inventory-items/inventory-items.service';
import { PaymentCallbackRegistryService } from '../mobile-payments/payment-callback/payment-callback-registry.service';
import { OrdersService } from '../orders/orders.service';
import { RentalsService } from '../rentals/rentals.service';
import { AppModule } from './app.module';

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
});

const hasuraSystemMock = {
  request: jest.fn().mockResolvedValue({}),
  executeQuery: jest.fn().mockResolvedValue({ rental_location_listings: [] }),
};

const hasuraUserMock = {
  getActivePersonaHeader: jest.fn(),
  executeQuery: jest.fn().mockResolvedValue({}),
};

describe('App bootstrap (DI smoke test)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HasuraSystemService)
      .useValue(hasuraSystemMock)
      .overrideProvider(HasuraUserService)
      .useValue(hasuraUserMock)
      .compile();

    app = moduleRef.createNestApplication();
    await moduleRef.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('resolves RentalsService and OrdersService', () => {
    expect(app.get(RentalsService)).toBeInstanceOf(RentalsService);
    expect(app.get(OrdersService)).toBeInstanceOf(OrdersService);
  });

  it('registers payment callback handlers from domain modules', async () => {
    const registry = app.get(PaymentCallbackRegistryService);
    const handlers = await registry.getHandlers();
    expect(handlers.length).toBeGreaterThanOrEqual(2);
  });

  it('listPublicRentalListings uses injected InventoryItemsService without DI errors', async () => {
    const rentals = app.get(RentalsService);
    const inventory = app.get(InventoryItemsService);
    jest.spyOn(inventory, 'isCatalogLocationSupported').mockResolvedValue(true);

    await expect(rentals.listPublicRentalListings({})).resolves.toEqual([]);
    expect(hasuraSystemMock.executeQuery).toHaveBeenCalled();
  });
});
