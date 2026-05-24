jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce(
      (result, part, index) => `${result}${part}${values[index] ?? ''}`,
      ''
    ),
}));

import { HttpStatus } from '@nestjs/common';
import { LocationsController } from './locations.controller';

describe('LocationsController', () => {
  const buildController = (consent: unknown = 'accepted_fg') => {
    const hasuraUserService = {
      getUserId: jest.fn().mockReturnValue('user-1'),
      getUser: jest.fn().mockResolvedValue({
        agent: {
          id: 'agent-1',
          location_tracking_consent: consent,
        },
      }),
    };
    const locationsService = {
      upsertMyAgentLocation: jest.fn().mockResolvedValue({
        agentId: 'agent-1',
        id: 'location-1',
        latitude: 1.23,
        longitude: 4.56,
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z',
      }),
    };
    const controller = new LocationsController(
      {} as any,
      hasuraUserService as any,
      {} as any,
      locationsService as any
    );
    return { controller, locationsService };
  };

  it('stores agent location after consent is accepted', async () => {
    const { controller, locationsService } = buildController('accepted_bg');

    const response = await controller.updateMyAgentLocation({
      latitude: 1.23,
      longitude: 4.56,
    });

    expect(response.success).toBe(true);
    expect(locationsService.upsertMyAgentLocation).toHaveBeenCalledWith(
      'agent-1',
      1.23,
      4.56
    );
  });

  it('rejects agent location updates without tracking consent', async () => {
    const { controller, locationsService } = buildController('rejected');

    await expect(
      controller.updateMyAgentLocation({ latitude: 1.23, longitude: 4.56 })
    ).rejects.toMatchObject({
      response: {
        success: false,
        error: 'Location tracking consent is required before sharing location',
      },
      status: HttpStatus.FORBIDDEN,
    });
    expect(locationsService.upsertMyAgentLocation).not.toHaveBeenCalled();
  });
});
