import type { StripeConfig } from '../config/configuration';
import { StripeCaptureService } from './stripe-capture.service';

describe('StripeCaptureService', () => {
  const stripeService = {};
  const databaseService = {};
  const accountsService = {};
  const configService = {
    get: jest.fn(),
  };

  let stripeConfig: StripeConfig;
  let service: StripeCaptureService;

  beforeEach(() => {
    jest.clearAllMocks();
    stripeConfig = {
      manualCaptureEnabled: false,
      manualCaptureCountries: [],
    } as StripeConfig;
    configService.get.mockImplementation((key: string) =>
      key === 'stripe' ? stripeConfig : undefined
    );
    service = new StripeCaptureService(
      stripeService as never,
      databaseService as never,
      configService as never,
      accountsService as never
    );
  });

  it('always uses manual capture for pickup orders', () => {
    expect(service.resolveCaptureMethodForOrderEntity('US', 'pickup')).toBe(
      'manual'
    );
  });

  it('keeps automatic capture for delivery when manual capture is disabled', () => {
    expect(service.resolveCaptureMethodForOrderEntity('US', 'delivery')).toBe(
      'automatic'
    );
  });

  it('applies the configured country gate to delivery orders', () => {
    stripeConfig.manualCaptureEnabled = true;
    stripeConfig.manualCaptureCountries = ['GA'];

    expect(service.resolveCaptureMethodForOrderEntity(' ga ', 'delivery')).toBe(
      'manual'
    );
    expect(service.resolveCaptureMethodForOrderEntity('US', 'delivery')).toBe(
      'automatic'
    );
  });
});
