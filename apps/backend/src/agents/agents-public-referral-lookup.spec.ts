jest.mock('../commissions/commissions.service', () => ({
  CommissionsService: jest.fn(),
}));
jest.mock('../hasura/hasura-system.service', () => ({
  HasuraSystemService: jest.fn(),
}));
jest.mock('../hasura/hasura-user.service', () => ({
  HasuraUserService: jest.fn(),
}));
jest.mock('./agent-hold.service', () => ({
  AgentHoldService: jest.fn(),
}));
jest.mock('./agent-referrals.service', () => ({
  AgentReferralsService: jest.fn(),
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpException } from '@nestjs/common';
import { AgentsController } from './agents.controller';

describe('AgentsController.getAgentByReferralCode (masked)', () => {
  const build = (lookup: Record<string, unknown> | null) => {
    const findAgentByCode = jest.fn().mockResolvedValue(lookup);
    const controller = new AgentsController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        normalizeAgentCode: (code: string) => {
          const normalized = code.trim().toUpperCase();
          return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
        },
        findAgentByCode,
      } as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { controller, findAgentByCode };
  };

  it('returns a masked name and drops email, id, and the rest of the last name', async () => {
    const { controller, findAgentByCode } = build({
      agentId: 'agent-1',
      userId: 'user-1',
      userFirstName: 'Jane',
      userLastName: '  Doe-Smith ',
      userEmail: 'jane.doe@example.com',
      status: 'active',
    });

    const res: any = await controller.getAgentByReferralCode(' ab12cd ');

    expect(findAgentByCode).toHaveBeenCalledWith('AB12CD');
    expect(res).toEqual({
      success: true,
      agentCode: 'AB12CD',
      fullName: 'Jane D.',
      firstName: 'Jane',
    });
    expect(JSON.stringify(res)).not.toMatch(/Doe|Smith|jane\.doe|agent-1|user-1/);
  });

  it('404s an inactive agent without echoing the lookup', async () => {
    const { controller } = build({
      userFirstName: 'Jane',
      userLastName: 'Doe',
      userEmail: 'jane.doe@example.com',
      status: 'suspended',
    });
    const error = await controller.getAgentByReferralCode('AB12CD').catch((caught) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toMatchObject({ error: 'Agent not found' });
    expect(JSON.stringify(error.getResponse())).not.toMatch(/Doe|jane\.doe/);
  });

  it('400s a bad code before looking anyone up', async () => {
    const { controller, findAgentByCode } = build(null);
    const error = await controller.getAgentByReferralCode('bad').catch((caught) => caught);

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({ error: 'Invalid referral code format' });
    expect(findAgentByCode).not.toHaveBeenCalled();
  });
});
