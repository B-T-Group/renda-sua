jest.mock('../addresses/addresses.service', () => ({ AddressesService: jest.fn() }));
jest.mock('../agents/agent-referrals.service', () => ({ AgentReferralsService: jest.fn() }));
jest.mock('../business-referrals/business-referrals.service', () => ({
  BusinessReferralsService: jest.fn(),
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../hasura/hasura-system.service', () => ({ HasuraSystemService: jest.fn() }));
jest.mock('../hasura/hasura-user.service', () => ({ HasuraUserService: jest.fn() }));

import { HttpException } from '@nestjs/common';
import { UsersController } from './users.controller';

describe('UsersController.getPublicByReferralCode (masked)', () => {
  const build = (overrides: {
    user?: any;
    canRefer?: boolean;
    agent?: any;
    business?: any;
  }) => {
    const c = Object.create(UsersController.prototype) as any;
    c.businessReferralsService = {
      normalizeReferralCode: (s: string) =>
        /^[A-Za-z0-9]{6}$/.test(s) ? s.toUpperCase() : null,
      findUserByReferralCode: jest.fn().mockResolvedValue(overrides.user ?? null),
      userCanRefer: jest.fn().mockResolvedValue(overrides.canRefer ?? true),
      findBusinessByCode: jest.fn().mockResolvedValue(overrides.business ?? null),
    };
    c.agentReferralsService = {
      findAgentByCode: jest.fn().mockResolvedValue(overrides.agent ?? null),
    };
    return c as UsersController;
  };

  it('masks user-level codes to first name + last initial', async () => {
    const res: any = await build({
      user: { userId: 'u1', userFirstName: 'Samuel', userLastName: 'Besong' },
    }).getPublicByReferralCode('ab12cd');
    expect(res).toMatchObject({ success: true, fullName: 'Samuel B.', kind: 'user' });
    expect(JSON.stringify(res)).not.toContain('Besong');
    expect(res).not.toHaveProperty('userId');
  });

  it('masks legacy agent codes', async () => {
    const res: any = await build({
      agent: { status: 'active', userFirstName: 'Jane', userLastName: 'Doe' },
    }).getPublicByReferralCode('AB12CD');
    expect(res.fullName).toBe('Jane D.');
    expect(JSON.stringify(res)).not.toContain('Doe');
  });

  it('returns business name with masked owner', async () => {
    const res: any = await build({
      business: {
        businessName: 'Renda Shop',
        userFirstName: 'Samuel',
        userLastName: 'Besong',
        lifecycleStatus: 'active',
        userEmail: 'x@y.z',
      },
    }).getPublicByReferralCode('AB12CD');
    expect(res).toMatchObject({
      fullName: 'Renda Shop (Samuel B.)',
      businessName: 'Renda Shop',
      ownerName: 'Samuel B.',
      kind: 'business',
    });
    expect(JSON.stringify(res)).not.toMatch(/Besong|x@y\.z/);
  });

  it('404s when nothing matches and 400s on bad format', async () => {
    await expect(build({}).getPublicByReferralCode('AB12CD')).rejects.toBeInstanceOf(
      HttpException
    );
    await expect(build({}).getPublicByReferralCode('bad')).rejects.toBeInstanceOf(
      HttpException
    );
  });
});
