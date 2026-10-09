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

function mapsConfig(): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'GOOGLE_MAPS_API_KEY') return 'test-key';
      if (key === 'GOOGLE_CACHE_ENABLED') return false;
      return fallback;
    }),
  } as unknown as ConfigService;
}

function component(type: string, longName: string, shortName = longName) {
  return { types: [type], long_name: longName, short_name: shortName };
}

function okGeocode(
  addressComponents: ReturnType<typeof component>[],
  formatted = 'Montreal, QC, Canada'
) {
  return {
    data: {
      status: 'OK',
      results: [{ formatted_address: formatted, address_components: addressComponents }],
    },
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
    service = new GoogleDistanceService(
      mapsConfig(),
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
    expect(result.address_line_1).toBe('Montreal, QC, Canada');
  });

  it('M3: never puts Google error_message into the thrown error', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'OVER_QUERY_LIMIT', error_message: 'You have exceeded your daily request quota' },
    });

    const error = await service.reverseGeocode(3.1, 11.1).catch((e) => e);

    expect(error.getStatus()).toBe(400);
    expect(JSON.stringify(error.getResponse())).not.toMatch(/quota|key/i);
  });

  it('builds the street line from number and route', async () => {
    mockedAxios.get.mockResolvedValue(
      okGeocode([
        component('street_number', '12'),
        component('route', 'Rue de la Paix'),
        component('country', 'Cameroon', 'cm'),
      ])
    );

    const result = await service.reverseGeocode(3.848, 11.502);

    expect(result.address_line_1).toBe('12 Rue de la Paix');
    expect(result.country_code).toBe('cm');
  });

  it('uses the route alone when the street number is missing', async () => {
    mockedAxios.get.mockResolvedValue(
      okGeocode([component('route', 'Market Road')], 'Market Road, Douala')
    );

    const result = await service.reverseGeocode(4.05, 9.7);

    expect(result.address_line_1).toBe('Market Road');
  });
});

describe('GoogleDistanceService.geocodeWithCountry', () => {
  let service: GoogleDistanceService;

  beforeEach(() => {
    mockedAxios.get.mockReset();
    service = new GoogleDistanceService(
      mapsConfig(),
      {} as unknown as GoogleCacheService
    );
  });

  it('uppercases the country code and keeps a zero coordinate', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'OK',
        results: [
          {
            geometry: { location: { lat: 0, lng: 0 } },
            address_components: [component('country', 'Ghana', 'gh')],
          },
        ],
      },
    });

    await expect(service.geocodeWithCountry('  Null Island  ')).resolves.toEqual({
      latitude: 0,
      longitude: 0,
      countryCode: 'GH',
      country: 'Ghana',
      locationType: '',
      partialMatch: false,
      hasStreet: false,
      hasCity: false,
    });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://maps.googleapis.com/maps/api/geocode/json',
      { params: { address: 'Null Island', key: 'test-key' }, timeout: 10_000 }
    );
  });

  it('M5: reports precision, partial match and street/city presence', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'OK',
        results: [
          {
            geometry: { location: { lat: 3.8, lng: 11.5 }, location_type: 'RANGE_INTERPOLATED' },
            partial_match: true,
            types: ['route'],
            address_components: [
              component('locality', 'Yaoundé'),
              component('country', 'Cameroon', 'CM'),
            ],
          },
        ],
      },
    });

    await expect(service.geocodeWithCountry('Rue X, Yaoundé')).resolves.toMatchObject({
      locationType: 'RANGE_INTERPOLATED',
      partialMatch: true,
      hasStreet: true,
      hasCity: true,
    });

    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'OK',
        results: [
          {
            geometry: { location: { lat: 3.8, lng: 11.5 }, location_type: 'APPROXIMATE' },
            types: ['locality', 'political'],
            address_components: [
              component('locality', 'Yaoundé'),
              component('country', 'Cameroon', 'CM'),
            ],
          },
        ],
      },
    });
    await expect(service.geocodeWithCountry('asdf, Yaoundé')).resolves.toMatchObject({
      locationType: 'APPROXIMATE',
      partialMatch: false,
      hasStreet: false,
      hasCity: true,
    });
  });

  it('does not call Google for a blank address', async () => {
    await expect(service.geocodeWithCountry('   ')).resolves.toBeNull();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns null only for a genuine no-match', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { status: 'ZERO_RESULTS', results: [] } });
    await expect(service.geocodeWithCountry('nowhere')).resolves.toBeNull();
  });

  it('throws on a denied/over-quota request and on a network error so the cron does not mark not_found', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { status: 'REQUEST_DENIED' } });
    await expect(service.geocodeWithCountry('denied')).rejects.toThrow(/REQUEST_DENIED/);

    mockedAxios.get.mockResolvedValueOnce({ data: { status: 'OVER_QUERY_LIMIT' } });
    await expect(service.geocodeWithCountry('quota')).rejects.toThrow(/OVER_QUERY_LIMIT/);

    mockedAxios.get.mockRejectedValueOnce(new Error('timeout'));
    await expect(service.geocodeWithCountry('offline')).rejects.toThrow('timeout');
  });

  it('returns null when the hit has no coordinates', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'OK',
        results: [{ address_components: [component('country', 'Cameroon', 'CM')] }],
      },
    });

    await expect(service.geocodeWithCountry('Yaoundé')).resolves.toBeNull();
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
