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
import type { AgentLocationTrackingConsent } from './dto/update-location-tracking-consent.dto';

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
    id: 'user-123',
    user_type_id: 'agent',
    agent: { id: 'agent-123' },
    personas: ['agent'],
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

  describe('location tracking consent', () => {
    const updatedAgent = (
      consent: AgentLocationTrackingConsent
    ) => ({
      id: agentUser.agent.id,
      location_tracking_consent: consent,
    });

    it('defaults missing persisted consent to not_shown before updating', async () => {
      hasuraSystemService.getAgentLocationConsent.mockResolvedValue(null);
      hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(
        updatedAgent('accepted_fg')
      );

      await expect(
        controller.updateLocationTrackingConsent({ consent: 'accepted_fg' })
      ).resolves.toEqual({
        success: true,
        agent: updatedAgent('accepted_fg'),
      });

      expect(hasuraSystemService.getAgentLocationConsent).toHaveBeenCalledWith(
        agentUser.agent.id
      );
      expect(hasuraSystemService.updateAgentLocationConsent).toHaveBeenCalledWith(
        agentUser.agent.id,
        'accepted_fg'
      );
    });

    it('blocks invalid consent transitions before mutating Hasura', async () => {
      hasuraSystemService.getAgentLocationConsent.mockResolvedValue('accepted_bg');

      await expect(
        controller.updateLocationTrackingConsent({ consent: 'not_shown' })
      ).rejects.toEqual(
        new HttpException(
          {
            success: false,
            error:
              'Cannot transition location_tracking_consent from accepted_bg to not_shown',
          },
          HttpStatus.BAD_REQUEST
        )
      );

      expect(
        hasuraSystemService.updateAgentLocationConsent
      ).not.toHaveBeenCalled();
    });

    it('rejects non-agent active personas without reading or updating consent', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        id: 'user-456',
        user_type_id: 'client',
        client: { id: 'client-456' },
        personas: ['client'],
      });

      await expect(
        controller.updateLocationTrackingConsent({ consent: 'accepted_fg' })
      ).rejects.toEqual(
        new HttpException(
          { success: false, error: 'User is not an agent' },
          HttpStatus.FORBIDDEN
        )
      );

      expect(hasuraSystemService.getAgentLocationConsent).not.toHaveBeenCalled();
      expect(
        hasuraSystemService.updateAgentLocationConsent
      ).not.toHaveBeenCalled();
    });

    it('resets rejected disclosure back to not_shown', async () => {
      hasuraSystemService.getAgentLocationConsent.mockResolvedValue('rejected');
      hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(
        updatedAgent('not_shown')
      );

      await expect(
        controller.resetLocationTrackingDisclosure()
      ).resolves.toEqual({
        success: true,
        agent: updatedAgent('not_shown'),
      });

      expect(hasuraSystemService.updateAgentLocationConsent).toHaveBeenCalledWith(
        agentUser.agent.id,
        'not_shown'
      );
    });

    it('returns not found when Hasura cannot update the agent row', async () => {
      hasuraSystemService.getAgentLocationConsent.mockResolvedValue('not_shown');
      hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(null);

      await expect(
        controller.updateLocationTrackingConsent({ consent: 'deferred' })
      ).rejects.toEqual(
        new HttpException(
          { success: false, error: 'Agent not found or could not be updated' },
          HttpStatus.NOT_FOUND
        )
      );
    });
  });
});
