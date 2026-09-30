import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DeliveryConfigService } from './delivery-configs.service';

describe('DeliveryConfigService pricing defaults', () => {
  const hasuraService = {
    executeQuery: jest.fn().mockResolvedValue({ country_delivery_configs: [] }),
  } as unknown as HasuraSystemService;

  const service = new DeliveryConfigService(hasuraService);

  it('falls back to a 5 km agent radius when the row is missing', async () => {
    await expect(service.getDeliveryAvailabilityRadiusKm('CA')).resolves.toBe(5);
  });

  it('uses the Cameroon base and per-km defaults when rows are missing', async () => {
    await expect(service.getNormalDeliveryBaseFee('CM')).resolves.toBe(500);
    await expect(service.getPerKmDeliveryFee('GA')).resolves.toBe(100);
  });
});
