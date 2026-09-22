import { AppConfigService } from './app-config.service';
import { DEFAULT_CLIENT_FLAGS } from './client-flags.constants';

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
    hasura.executeQuery.mockRejectedValue(new Error('db down'));
    const flags = await service.getClientFlags();
    expect(flags).toEqual(DEFAULT_CLIENT_FLAGS);
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
});
