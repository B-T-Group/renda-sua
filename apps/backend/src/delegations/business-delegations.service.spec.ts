jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpStatus } from '@nestjs/common';
import { BusinessDelegationsService } from './business-delegations.service';

describe('BusinessDelegationsService', () => {
  let hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock };
  let notifications: { sendLocationDelegationInviteEmail: jest.Mock };
  let service: BusinessDelegationsService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
    notifications = {
      sendLocationDelegationInviteEmail: jest.fn().mockResolvedValue(undefined),
    };
    service = new BusinessDelegationsService(
      hasura as any,
      notifications as any,
      { get: jest.fn().mockReturnValue('https://rendasua.com') } as any
    );
  });

  it('rejects a non-assignable role on invite', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('OwnedLocation')) {
        return {
          business_locations_by_pk: {
            id: 'loc-1',
            name: 'Downtown',
            business_id: 'biz-1',
            business: { id: 'biz-1', name: 'Acme' },
          },
        };
      }
      if (String(query).includes('Role(') || String(query).includes('Role($id')) {
        return {
          location_delegation_roles_by_pk: {
            id: 'role-cat',
            key: 'catalog_manager',
            name: 'Catalog Manager',
            description: '',
            is_assignable: false,
          },
        };
      }
      return {};
    });
    await expect(
      service.createInvite(
        { id: 'owner-1', email: 'owner@example.com', first_name: 'Pat' },
        'biz-1',
        {
          email: 'jane@example.com',
          business_location_id: 'loc-1',
          role_id: 'role-cat',
        }
      )
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects inviting the owner email', async () => {
    await expect(
      service.createInvite(
        { id: 'owner-1', email: 'owner@example.com' },
        'biz-1',
        {
          email: 'owner@example.com',
          business_location_id: 'loc-1',
          role_id: 'role-om',
        }
      )
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
  });
});
