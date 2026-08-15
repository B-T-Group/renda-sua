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

  it('rejects an invalid invite email', async () => {
    await expect(
      service.createInvite(
        { id: 'owner-1', email: 'owner@example.com' },
        'biz-1',
        {
          email: 'not-an-email',
          business_location_id: 'loc-1',
          role_id: 'role-om',
        }
      )
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('rejects a location owned by another business', async () => {
    hasura.executeQuery.mockResolvedValue({
      business_locations_by_pk: {
        id: 'loc-1',
        name: 'Downtown',
        business_id: 'other-biz',
        business: { id: 'other-biz', name: 'Other' },
      },
    });
    await expect(
      service.createInvite(
        { id: 'owner-1', email: 'owner@example.com' },
        'biz-1',
        {
          email: 'jane@example.com',
          business_location_id: 'loc-1',
          role_id: 'role-om',
        }
      )
    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('supersedes a pending invite then emails the new token', async () => {
    mockAssignableInviteLookups();
    hasura.executeMutation.mockImplementation(async (query: string) => {
      if (String(query).includes('InsertInvite')) {
        return {
          insert_location_delegation_invites_one: {
            id: 'inv-2',
            email: 'jane@example.com',
            status: 'pending',
            expires_at: '2026-08-22T00:00:00.000Z',
            role_id: 'role-om',
            business_location_id: 'loc-1',
            first_name: null,
            last_name: null,
            invited_by_user_id: 'owner-1',
          },
        };
      }
      return { insert_location_delegation_events_one: { id: 'evt-1' } };
    });

    const result = await service.createInvite(
      { id: 'owner-1', email: 'owner@example.com', first_name: 'Pat' },
      'biz-1',
      {
        email: ' Jane@Example.com ',
        business_location_id: 'loc-1',
        role_id: 'role-om',
      }
    );

    expect(result.invite.email).toBe('jane@example.com');
    const mutations = hasura.executeMutation.mock.calls.map((c) => String(c[0]));
    expect(mutations.some((q) => q.includes('SupersedePending'))).toBe(true);
    expect(mutations.some((q) => q.includes('InsertInvite'))).toBe(true);
    expect(notifications.sendLocationDelegationInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        acceptUrl: expect.stringMatching(/^https:\/\/rendasua.com\/invite\/[0-9a-f]{64}$/),
      })
    );
  });

  it('blocks assigning a delegation role to the owner', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegations_by_pk: {
        id: 'grant-1',
        user_id: 'owner-1',
        role_id: 'role-om',
        status: 'active',
        business_location_id: 'loc-1',
        business_location: { business_id: 'biz-1' },
        role: { id: 'role-om', key: 'order_manager', name: 'Order Manager' },
        user: { id: 'owner-1', email: 'owner@example.com' },
      },
    });
    await expect(
      service.changeMemberRole(
        { id: 'owner-1', email: 'owner@example.com' },
        'biz-1',
        'grant-1',
        'role-om'
      )
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('revokes an active member for the owning business', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegations_by_pk: {
        id: 'grant-1',
        user_id: 'staff-1',
        role_id: 'role-om',
        status: 'active',
        business_location_id: 'loc-1',
        business_location: { business_id: 'biz-1' },
        role: { id: 'role-om', key: 'order_manager', name: 'Order Manager' },
        user: { id: 'staff-1', email: 'jane@example.com' },
      },
    });
    hasura.executeMutation.mockResolvedValue({
      update_location_delegations_by_pk: { id: 'grant-1', status: 'revoked' },
      insert_location_delegation_events_one: { id: 'evt-1' },
    });

    await expect(
      service.revokeMember('owner-1', 'biz-1', 'grant-1')
    ).resolves.toEqual({ success: true });
    const revokeCall = hasura.executeMutation.mock.calls.find((c) =>
      String(c[0]).includes('RevokeDelegation')
    );
    expect(revokeCall?.[1]).toEqual(
      expect.objectContaining({ id: 'grant-1' })
    );
  });

  it('does not resend an invite owned by another business', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegation_invites_by_pk: {
        id: 'inv-1',
        email: 'jane@example.com',
        status: 'pending',
        expires_at: '2026-08-22T00:00:00.000Z',
        role_id: 'role-om',
        business_location_id: 'loc-1',
        invited_by_user_id: 'owner-1',
        business_location: { business_id: 'other-biz' },
      },
    });
    await expect(
      service.resendInvite({ id: 'owner-1' }, 'biz-1', 'inv-1')
    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects changing the role of a consumed invite', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegation_invites_by_pk: {
        id: 'inv-1',
        email: 'jane@example.com',
        status: 'accepted',
        expires_at: '2026-08-22T00:00:00.000Z',
        role_id: 'role-om',
        business_location_id: 'loc-1',
        invited_by_user_id: 'owner-1',
        business_location: { business_id: 'biz-1' },
      },
    });
    await expect(
      service.patchInviteRole('owner-1', 'biz-1', 'inv-1', 'role-om')
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  function mockAssignableInviteLookups() {
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
      if (String(query).includes('Role($id')) {
        return {
          location_delegation_roles_by_pk: {
            id: 'role-om',
            key: 'order_manager',
            name: 'Order Manager',
            description: '',
            is_assignable: true,
          },
        };
      }
      return {};
    });
  }
});
