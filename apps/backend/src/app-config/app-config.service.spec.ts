import { AppConfigService } from './app-config.service';
import { DEFAULT_CLIENT_FLAGS, rentalsRequestCardEnabled } from './client-flags.constants';

describe('AppConfigService', () => {
  const hasura = {
    executeQuery: jest.fn(),
  };

  let service: AppConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppConfigService(hasura as any);
  });

  it('returns defaults when query fails', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    hasura.executeQuery.mockRejectedValue(new Error('db down'));
    try {
      const flags = await service.getClientFlags();
      expect(flags).toEqual(DEFAULT_CLIENT_FLAGS);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('resolves global boolean flags', async () => {
    hasura.executeQuery.mockResolvedValue({
      application_configurations: [
        {
          config_key: 'reels_enabled',
          boolean_value: true,
          country_code: null,
          status: 'active',
        },
      ],
    });
    const flags = await service.getClientFlags();
    expect(flags.reels_enabled).toBe(true);
    expect(flags.floating_nav_enabled).toBe(false);
    expect(flags.reorder_v1).toBe(DEFAULT_CLIENT_FLAGS.reorder_v1);
  });

  it('honors configured reorder_v1 over environment default', async () => {
    hasura.executeQuery.mockResolvedValue({
      application_configurations: [
        {
          config_key: 'reorder_v1',
          boolean_value: true,
          country_code: null,
          status: 'active',
        },
      ],
    });
    const flags = await service.getClientFlags();
    expect(flags.reorder_v1).toBe(true);
  });

  it('forces the request card on in development and keeps a false row otherwise', async () => {
    expect(rentalsRequestCardEnabled(false, 'development')).toBe(true);
    expect(rentalsRequestCardEnabled(false, 'production')).toBe(false);
    expect(rentalsRequestCardEnabled(false, 'test')).toBe(false);
    hasura.executeQuery.mockResolvedValue({
      application_configurations: [
        {
          config_key: 'rentals_request_card_enabled',
          boolean_value: false,
          country_code: null,
          status: 'active',
        },
      ],
    });
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      const dev = await new AppConfigService(hasura as any).getClientFlags();
      expect(dev.rentals_request_card_enabled).toBe(true);
      process.env.NODE_ENV = 'production';
      const prod = await new AppConfigService(hasura as any).getClientFlags();
      expect(prod.rentals_request_card_enabled).toBe(false);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
