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

describe('AgentsController', () => {
  let controller: AgentsController;
  let hasuraUserService: {
    getUser: jest.Mock;
    getActivePersonaHeader: jest.Mock;
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
      getUser: jest.fn().mockResolvedValue(agentUser),
      getActivePersonaHeader: jest.fn().mockReturnValue(undefined),
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

  describe('updateLocationTrackingConsent', () => {
    it('reads and updates Android consent independently', async () => {
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
      expect(
        hasuraSystemService.updateAgentLocationConsent
      ).toHaveBeenCalledWith('agent-1', 'android', 'accepted_bg');
    });

    it('rejects invalid consent transitions before mutating', async () => {
      hasuraSystemService.getAgentLocationConsent.mockResolvedValue('rejected');

      await expect(
        controller.updateLocationTrackingConsent({
          platform: 'ios',
          consent: 'accepted_fg',
        })
      ).rejects.toThrow(
        new HttpException(
          {
            success: false,
            error:
              'Cannot transition location_tracking_consent from rejected to accepted_fg',
          },
          HttpStatus.BAD_REQUEST
        )
      );
      expect(
        hasuraSystemService.updateAgentLocationConsent
      ).not.toHaveBeenCalled();
    });

    it('forbids non-agent users before reading consent state', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        id: 'user-2',
        user_type_id: 'client',
        personas: ['client'],
        client: { id: 'client-1' },
      });

      await expect(
        controller.updateLocationTrackingConsent({
          platform: 'ios',
          consent: 'accepted_fg',
        })
      ).rejects.toThrow(
        new HttpException(
          { success: false, error: 'User is not an agent' },
          HttpStatus.FORBIDDEN
        )
      );
      expect(hasuraSystemService.getAgentLocationConsent).not.toHaveBeenCalled();
    });
  });

  describe('resetLocationTrackingDisclosure', () => {
    it('resets only the requested platform to not_shown', async () => {
      const agent = {
        id: 'agent-1',
        location_tracking_consent_ios: 'not_shown',
        location_tracking_consent_android: 'accepted_bg',
      };
      hasuraSystemService.getAgentLocationConsent.mockResolvedValue(
        'accepted_fg'
      );
      hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(agent);

      await expect(
        controller.resetLocationTrackingDisclosure({ platform: 'ios' })
      ).resolves.toEqual({ success: true, agent });
      expect(hasuraSystemService.getAgentLocationConsent).toHaveBeenCalledWith(
        'agent-1',
        'ios'
      );
      expect(
        hasuraSystemService.updateAgentLocationConsent
      ).toHaveBeenCalledWith('agent-1', 'ios', 'not_shown');
    });
  });
});
