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

  it('treats a missing cap and waiver threshold as unset', async () => {
    await expect(service.getMaxDeliveryFee('CM')).resolves.toBe(0);
    await expect(service.getFreeDeliveryCommissionThreshold('CM')).resolves.toBe(0);
  });
});

describe('DeliveryConfigService configured fee caps', () => {
  const hasuraService = {
    executeQuery: jest.fn(async (_query: string, variables: { config_key: string }) => {
      const values: Record<string, string> = {
        max_delivery_fee: '1000',
        free_delivery_commission_threshold: '10000',
      };
      const value = values[variables.config_key];
      if (!value) return { country_delivery_configs: [] };
      return {
        country_delivery_configs: [{ config_value: value, data_type: 'number' }],
      };
    }),
  } as unknown as HasuraSystemService;

  const service = new DeliveryConfigService(hasuraService);

  it('reads a positive cap and commission threshold', async () => {
    await expect(service.getMaxDeliveryFee('CM')).resolves.toBe(1000);
    await expect(service.getFreeDeliveryCommissionThreshold('GA')).resolves.toBe(10000);
  });

  it('treats zero and negative caps as unset', async () => {
    (hasuraService.executeQuery as jest.Mock).mockResolvedValueOnce({
      country_delivery_configs: [{ config_value: '0', data_type: 'number' }],
    });
    await expect(service.getMaxDeliveryFee('CM')).resolves.toBe(0);

    (hasuraService.executeQuery as jest.Mock).mockResolvedValueOnce({
      country_delivery_configs: [{ config_value: '-20', data_type: 'number' }],
    });
    await expect(service.getFreeDeliveryCommissionThreshold('CM')).resolves.toBe(0);
  });
});
