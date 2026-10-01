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

describe('AdminMapService.search', () => {
  it('does not query when the term is shorter than two characters', async () => {
    const executeQuery = jest.fn();
    const service = new AdminMapService({ executeQuery } as any);

    await expect(service.search(' a ')).resolves.toEqual({ results: [] });
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('searches agents and merchants and escapes wildcard characters', async () => {
    const executeQuery = jest.fn(async (query: string) => {
      if (String(query).includes('AdminMapSearchAgents')) {
        return { agents: [agentSource()] };
      }
      if (String(query).includes('AdminMapSearchLocations')) {
        return { business_locations: [] };
      }
      return {};
    });
    const service = new AdminMapService({ executeQuery } as any);

    const result = await service.search('100%_off');

    expect(result.results).toEqual([
      expect.objectContaining({ id: 'agent-1', kind: 'agent', title: 'Awa Ngo' }),
    ]);
    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('AdminMapSearchAgents'),
      expect.objectContaining({
        where: {
          _and: [
            {
              _or: expect.arrayContaining([
                { user: { email: { _ilike: '%100\\%\\_off%' } } },
              ]),
            },
          ],
        },
      })
    );
  });
});

describe('AdminMapService.activeOrders', () => {
  it('asks Hasura for at most 30 open orders', async () => {
    const executeQuery = jest.fn().mockResolvedValue({ orders: [] });
    const service = new AdminMapService({ executeQuery } as any);

    await service.activeOrders('');

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('AdminMapSearchOrders'),
      expect.objectContaining({
        limit: 30,
        where: { current_status: { _nin: expect.arrayContaining(['complete']) } },
      })
    );
  });
});

function agentSource() {
  return {
    id: 'agent-1',
    status: 'active',
    is_available: true,
    user: { first_name: 'Awa', last_name: 'Ngo', email: 'awa@example.com' },
    agent_locations: [],
    agent_addresses: [],
  };
}
