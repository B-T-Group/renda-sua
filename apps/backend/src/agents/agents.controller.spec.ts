import { HttpException, HttpStatus } from '@nestjs/common';

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

import { AgentsController } from './agents.controller';

describe('AgentsController location tracking consent', () => {
  let controller: AgentsController;
  let hasuraUserService: {
    getActivePersonaHeader: jest.Mock;
    getUser: jest.Mock;
  };
  let hasuraSystemService: {
    getAgentLocationConsent: jest.Mock;
    updateAgentLocationConsent: jest.Mock;
  };

  const agentUser = {
    id: 'user-1',
    user_type_id: 'agent',
    personas: ['agent'],
    agent: { id: 'agent-1' },
  };

  beforeEach(() => {
    hasuraUserService = {
      getActivePersonaHeader: jest.fn().mockReturnValue(undefined),
      getUser: jest.fn().mockResolvedValue(agentUser),
    };
    hasuraSystemService = {
      getAgentLocationConsent: jest.fn(),
      updateAgentLocationConsent: jest.fn(),
    };
    controller = new AgentsController(
      hasuraUserService as any,
      hasuraSystemService as any,
      {} as any,
      {} as any,
      {} as any
    );
  });

  it('updates only the requested Android consent field', async () => {
    const agent = {
      id: 'agent-1',
      location_tracking_consent_ios: 'not_shown',
      location_tracking_consent_android: 'accepted_bg',
    };
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue('not_shown');
    hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(agent);

    await expect(
      controller.updateLocationTrackingConsent({
        platform: 'android',
        consent: 'accepted_bg',
      })
    ).resolves.toEqual({ success: true, agent });

    expect(hasuraSystemService.getAgentLocationConsent).toHaveBeenCalledWith(
      'agent-1',
      'android'
    );
    expect(hasuraSystemService.updateAgentLocationConsent).toHaveBeenCalledWith(
      'agent-1',
      'android',
      'accepted_bg'
    );
  });

  it('resets the requested iOS disclosure after prior acceptance', async () => {
    const agent = {
      id: 'agent-1',
      location_tracking_consent_ios: 'not_shown',
      location_tracking_consent_android: 'accepted_bg',
    };
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue('accepted_bg');
    hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(agent);

    await expect(
      controller.resetLocationTrackingDisclosure({ platform: 'ios' })
    ).resolves.toEqual({ success: true, agent });

    expect(hasuraSystemService.getAgentLocationConsent).toHaveBeenCalledWith(
      'agent-1',
      'ios'
    );
    expect(hasuraSystemService.updateAgentLocationConsent).toHaveBeenCalledWith(
      'agent-1',
      'ios',
      'not_shown'
    );
  });

  it('does not mutate consent when the transition is invalid', async () => {
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue('rejected');

    try {
      await controller.updateLocationTrackingConsent({
        platform: 'ios',
        consent: 'accepted_fg',
      });
      throw new Error('Expected updateLocationTrackingConsent to throw');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.getResponse()).toEqual({
        success: false,
        error:
          'Cannot transition location_tracking_consent from rejected to accepted_fg',
      });
    }
    expect(hasuraSystemService.updateAgentLocationConsent).not.toHaveBeenCalled();
  });

  it('forbids location consent updates from non-agent personas', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      id: 'user-1',
      user_type_id: 'client',
      personas: ['client'],
      client: { id: 'client-1' },
    });

    try {
      await controller.updateLocationTrackingConsent({
        platform: 'ios',
        consent: 'accepted_fg',
      });
      throw new Error('Expected updateLocationTrackingConsent to throw');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(error.getResponse()).toEqual({
        success: false,
        error: 'User is not an agent',
      });
    }
    expect(hasuraSystemService.getAgentLocationConsent).not.toHaveBeenCalled();
  });
});
