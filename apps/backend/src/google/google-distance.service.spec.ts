import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  DISTANCE_MATRIX_MAX_DESTINATIONS,
  GoogleDistanceService,
} from './google-distance.service';
import type { GoogleCacheService } from './google-cache.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const ORIGIN_ID = 'd4182b35-9abc-4619-aa3f-f3244c4ef29c';

function dest(n: number) {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    formatted: `${n},0`,
  };
}

function okMatrix(destinationStrings: string[]) {
  return {
    data: {
      status: 'OK',
      origin_addresses: ['1,1'],
      destination_addresses: destinationStrings,
      rows: [
        {
          elements: destinationStrings.map(() => ({
            status: 'OK',
            distance: { text: '1 km', value: 1000 },
            duration: { text: '2 mins', value: 120 },
          })),
        },
      ],
    },
  };
}

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

describe('GoogleDistanceService.getDistanceMatrixWithCaching', () => {
  let cacheService: {
    getValidCachedDistanceElements: jest.Mock;
    cacheDistanceMatrixResults: jest.Mock;
  };
  let service: GoogleDistanceService;

  beforeEach(() => {
    mockedAxios.get.mockReset();
    cacheService = {
      getValidCachedDistanceElements: jest.fn().mockResolvedValue([]),
      cacheDistanceMatrixResults: jest.fn().mockResolvedValue(undefined),
    };
    service = new GoogleDistanceService(
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          if (key === 'GOOGLE_MAPS_API_KEY') return 'test-key';
          return fallback;
        }),
      } as any,
      cacheService as unknown as GoogleCacheService
    );
  });

  function destinationParamSizes(): number[] {
    return mockedAxios.get.mock.calls.map((call) => {
      const params = call[1]?.params as { destinations: string };
      return params.destinations.split('|').length;
    });
  }

  it('chunks destinations into groups of 25', async () => {
    mockedAxios.get.mockImplementation(async (_url, config) => {
      const destinations = (config?.params as { destinations: string }).destinations;
      return okMatrix(destinations.split('|'));
    });
    const destinations = Array.from({ length: 63 }, (_, i) => dest(i + 1));

    const matrix = await service.getDistanceMatrixWithCaching(
      ORIGIN_ID,
      '1,1',
      destinations
    );

    expect(destinationParamSizes()).toEqual([25, 25, 13]);
    expect(matrix.rows[0].elements).toHaveLength(63);
    expect(cacheService.cacheDistanceMatrixResults).toHaveBeenCalledTimes(3);
  });

  it('only requests cache misses from Google', async () => {
    const destinations = [dest(1), dest(2), dest(3)];
    cacheService.getValidCachedDistanceElements.mockResolvedValue([
      {
        destination_address_id: dest(1).id,
        destination_address_formatted: dest(1).formatted,
        origin_address_formatted: '1,1',
        status: 'OK',
        distance: { text: 'cached', value: 50 },
        duration: { text: '1 min', value: 60 },
      },
    ]);
    mockedAxios.get.mockResolvedValue(okMatrix([dest(2).formatted, dest(3).formatted]));

    const matrix = await service.getDistanceMatrixWithCaching(
      ORIGIN_ID,
      '1,1',
      destinations
    );

    expect(destinationParamSizes()).toEqual([2]);
    expect(matrix.rows[0].elements[0].distance?.value).toBe(50);
    expect(matrix.rows[0].elements[1].status).toBe('OK');
    expect(cacheService.cacheDistanceMatrixResults).toHaveBeenCalledTimes(1);
  });

  it('skips cache for anonymous non-uuid origins', async () => {
    mockedAxios.get.mockResolvedValue(okMatrix([dest(1).formatted]));

    await service.getDistanceMatrixWithCaching(
      'anon:4.05000:9.70000',
      '4.05,9.7',
      [dest(1)]
    );

    expect(cacheService.getValidCachedDistanceElements).not.toHaveBeenCalled();
    expect(cacheService.cacheDistanceMatrixResults).not.toHaveBeenCalled();
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('includes Google status when the matrix request is rejected', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'MAX_DIMENSIONS_EXCEEDED' },
    });

    try {
      await service.getDistanceMatrixWithCaching(ORIGIN_ID, '1,1', [dest(1)]);
      fail('expected Google matrix error');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.message).toContain('MAX_DIMENSIONS_EXCEEDED');
    }
  });

  it('does not call Google when every pair is cached', async () => {
    cacheService.getValidCachedDistanceElements.mockResolvedValue([
      {
        destination_address_id: dest(1).id,
        destination_address_formatted: dest(1).formatted,
        origin_address_formatted: '1,1',
        status: 'OK',
        distance: { text: 'cached', value: 50 },
      },
    ]);

    const matrix = await service.getDistanceMatrixWithCaching(
      ORIGIN_ID,
      '1,1',
      [dest(1)]
    );

    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(matrix.rows[0].elements[0].distance?.value).toBe(50);
  });
});

describe('GoogleDistanceService.getDistanceMatrix', () => {
  let service: GoogleDistanceService;

  beforeEach(() => {
    mockedAxios.get.mockReset();
    service = new GoogleDistanceService(
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          if (key === 'GOOGLE_MAPS_API_KEY') return 'test-key';
          return fallback;
        }),
      } as any,
      {
        getValidCachedDistanceElements: jest.fn(),
        cacheDistanceMatrixResults: jest.fn(),
      } as any
    );
  });

  it('chunks a single-origin request over the destination cap', async () => {
    mockedAxios.get.mockImplementation(async (_url, config) => {
      const destinations = (config?.params as { destinations: string }).destinations;
      return okMatrix(destinations.split('|'));
    });
    const destinations = Array.from(
      { length: DISTANCE_MATRIX_MAX_DESTINATIONS + 2 },
      (_, i) => `${i},0`
    );

    const matrix = await service.getDistanceMatrix(['1,1'], destinations);

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(matrix.rows[0].elements).toHaveLength(destinations.length);
  });
});
