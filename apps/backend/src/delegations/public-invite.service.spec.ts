import { HttpException, HttpStatus } from '@nestjs/common';
import { PublicInviteService } from './public-invite.service';
import { hashInviteToken } from './token.util';

describe('PublicInviteService', () => {
  const token = 'invite-token';
  const pendingInvite = {
    id: 'inv-1',
    email: 'jane@example.com',
    status: 'pending',
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    role_id: 'role-om',
    first_name: 'Jane',
    last_name: 'Doe',
    business_location_id: 'loc-1',
    role: { id: 'role-om', key: 'order_manager', name: 'Order Manager' },
    invited_by: { first_name: 'Owner', business: { id: 'biz-1' } },
    business_location: {
      id: 'loc-1',
      name: 'Downtown',
      business: { id: 'biz-1', name: 'Acme' },
    },
  };

  let hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock };
  let auth0: { startEmailOtp: jest.Mock };
  let service: PublicInviteService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
    auth0 = { startEmailOtp: jest.fn().mockResolvedValue(undefined) };
    service = new PublicInviteService(hasura as any, auth0 as any);
  });

  function mockPendingInvite() {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('InviteByHash')) {
        return { location_delegation_invites: [pendingInvite] };
      }
      if (String(query).includes('UserByEmail')) {
        return { users: [{ id: 'user-existing', email: pendingInvite.email }] };
      }
      if (String(query).includes('ActiveGrant')) {
        return { location_delegations: [{ id: 'grant-1' }] };
      }
      return {};
    });
    hasura.executeMutation.mockResolvedValue({});
  }

  it('previews without consuming the invite', async () => {
    mockPendingInvite();
    const preview = await service.preview(token);
    expect(preview.role_name).toBe('Order Manager');
    expect(preview.business_name).toBe('Acme');
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('InviteByHash'),
      { hash: hashInviteToken(token) }
    );
  });

  it('attaches an existing user and starts OTP', async () => {
    mockPendingInvite();
    const result = await service.accept(token, {});
    expect(result).toEqual({
      success: true,
      already_authenticated: false,
      email: pendingInvite.email,
    });
    expect(auth0.startEmailOtp).toHaveBeenCalledWith(pendingInvite.email);
    const mutations = hasura.executeMutation.mock.calls.map((c) => String(c[0]));
    expect(mutations.some((q) => q.includes('CreateDelegateUser'))).toBe(false);
    expect(mutations.some((q) => q.includes('ConsumeInvite'))).toBe(true);
  });

  it('returns 409 when logged in as a different email', async () => {
    mockPendingInvite();
    await expect(
      service.accept(token, {}, { userId: 'other', email: 'other@example.com' })
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects invites after the location changes owner', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegation_invites: [
        {
          ...pendingInvite,
          invited_by: { first_name: 'Owner', business: { id: 'biz-old' } },
          business_location: {
            id: 'loc-1',
            name: 'Downtown',
            business: { id: 'biz-new', name: 'New Co' },
          },
        },
      ],
    });
    await expect(service.preview(token)).rejects.toMatchObject({
      status: HttpStatus.GONE,
    });
    await expect(service.accept(token, {})).rejects.toMatchObject({
      status: HttpStatus.GONE,
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects expired invites', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegation_invites: [
        { ...pendingInvite, expires_at: '2020-01-01T00:00:00.000Z' },
      ],
    });
    await expect(service.preview(token)).rejects.toBeInstanceOf(HttpException);
    await expect(service.preview(token)).rejects.toMatchObject({
      status: HttpStatus.GONE,
    });
  });
});
