import { ConfigurationsService } from '../admin/configurations.service';
import { roundServiceFee, ServiceFeeService } from './service-fee.service';

describe('roundServiceFee', () => {
  it('keeps XAF whole and CAD cents', () => {
    expect(roundServiceFee(100.4, 'XAF')).toBe(100);
    expect(roundServiceFee(0.99, 'CAD')).toBe(0.99);
    expect(roundServiceFee(0, 'XAF')).toBe(0);
    expect(roundServiceFee(Number.NaN, 'CAD')).toBe(0);
  });
});

describe('ServiceFeeService', () => {
  const configurations = {
    getConfigurationByKey: jest.fn(),
  } as unknown as ConfigurationsService;
  const service = new ServiceFeeService(configurations);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the country row rounded to the currency', async () => {
    (configurations.getConfigurationByKey as jest.Mock).mockResolvedValue({
      number_value: 0.994,
    });
    await expect(service.resolve('Canada', 'CAD')).resolves.toBe(0.99);
    expect(configurations.getConfigurationByKey).toHaveBeenCalledWith(
      'service_fee',
      'CA'
    );
  });

  it('returns 0 when the country is unknown or the row is missing', async () => {
    await expect(service.resolve('', 'XAF')).resolves.toBe(0);
    (configurations.getConfigurationByKey as jest.Mock).mockResolvedValue(null);
    await expect(service.resolve('US', 'USD')).resolves.toBe(0);
  });
});
