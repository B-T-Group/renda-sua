import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { GoogleCacheService } from './google-cache.service';
import { GoogleDistanceService } from './google-distance.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GoogleDistanceService.reverseGeocode', () => {
  let service: GoogleDistanceService;

  beforeEach(() => {
    mockedAxios.get.mockReset();
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'GOOGLE_MAPS_API_KEY') return 'test-key';
        if (key === 'GOOGLE_CACHE_ENABLED') return false;
        return fallback;
      }),
    } as unknown as ConfigService;
    service = new GoogleDistanceService(
      configService,
      {} as unknown as GoogleCacheService
    );
  });

  it('exposes the ISO-2 short name as country_code', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'OK',
        results: [
          {
            formatted_address: 'Montreal, QC, Canada',
            address_components: [
              {
                types: ['administrative_area_level_1'],
                long_name: 'Québec',
                short_name: 'QC',
              },
              {
                types: ['country'],
                long_name: 'Canada',
                short_name: 'CA',
              },
            ],
          },
        ],
      },
    });

    const result = await service.reverseGeocode(45.5, -73.6);

    expect(result.country).toBe('Canada');
    expect(result.country_code).toBe('CA');
    expect(result.state).toBe('Québec');
  });
});
