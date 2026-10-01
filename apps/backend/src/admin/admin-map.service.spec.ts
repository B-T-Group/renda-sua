import { BadRequestException } from '@nestjs/common';
import { ADMIN_MAP_REGIONS_QUERY } from './admin-map.queries';
import { AdminMapService } from './admin-map.service';

describe('AdminMapService.getRegions', () => {
  it('binds country_code with bpchar, not String', async () => {
    const executeQuery = jest.fn().mockResolvedValue({
      supported_country_states: [
        { state_name: 'Littoral', country_name: 'Cameroon' },
        { state_name: 'Centre', country_name: 'Cameroon' },
      ],
    });
    const service = new AdminMapService({ executeQuery } as any);

    const result = await service.getRegions('cm');

    expect(ADMIN_MAP_REGIONS_QUERY).toContain('$code: bpchar!');
    expect(ADMIN_MAP_REGIONS_QUERY).not.toContain('$code: String!');
    expect(executeQuery).toHaveBeenCalledWith(ADMIN_MAP_REGIONS_QUERY, {
      code: 'CM',
    });
    expect(result).toEqual({
      regions: [{ stateName: 'Littoral' }, { stateName: 'Centre' }],
    });
  });

  it('rejects a missing country', async () => {
    const service = new AdminMapService({ executeQuery: jest.fn() } as any);
    await expect(service.getRegions('')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
