import { HttpException, HttpStatus } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import type { AgentLocationTrackingConsent } from './dto/update-location-tracking-consent.dto';

jest.mock('../commissions/commissions.service', () => ({
  CommissionsService: class CommissionsService {},
}));
jest.mock('../hasura/hasura-system.service', () => ({
  HasuraSystemService: class HasuraSystemService {},
}));
jest.mock('../hasura/hasura-user.service', () => ({
  HasuraUserService: class HasuraUserService {},
}));
jest.mock('./agent-hold.service', () => ({
  AgentHoldService: class AgentHoldService {},
}));
jest.mock('./agent-referrals.service', () => ({
  AgentReferralsService: class AgentReferralsService {},
}));

describe('AgentsController location tracking consent', () => {
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
    agent: { id: 'agent-1' },
    personas: ['agent'],
  };

  async function expectHttpException(
    promise: Promise<unknown>,
    status: HttpStatus,
    response: Record<string, unknown>
  ) {
    try {
      await promise;
      throw new Error('Expected request to reject');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(status);
      expect(error.getResponse()).toEqual(response);
    }
  }

  beforeEach(() => {
    hasuraUserService = {
      getUser: jest.fn().mockResolvedValue(agentUser),
      getActivePersonaHeader: jest.fn().mockReturnValue('agent'),
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

  it('updates consent after validating an allowed transition', async () => {
    const agent = { id: 'agent-1', location_tracking_consent: 'accepted_fg' };
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue('not_shown');
    hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(agent);

    await expect(
      controller.updateLocationTrackingConsent({ consent: 'accepted_fg' })
    ).resolves.toEqual({ success: true, agent });
    expect(hasuraSystemService.getAgentLocationConsent).toHaveBeenCalledWith(
      'agent-1'
    );
    expect(hasuraSystemService.updateAgentLocationConsent).toHaveBeenCalledWith(
      'agent-1',
      'accepted_fg'
    );
  });

  it('treats missing stored consent as not_shown before updating', async () => {
    const agent = { id: 'agent-1', location_tracking_consent: 'accepted_bg' };
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue(null);
    hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(agent);

    await expect(
      controller.updateLocationTrackingConsent({ consent: 'accepted_bg' })
    ).resolves.toEqual({ success: true, agent });
    expect(hasuraSystemService.updateAgentLocationConsent).toHaveBeenCalledWith(
      'agent-1',
      'accepted_bg'
    );
  });

  it('rejects invalid consent transitions without mutating Hasura', async () => {
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue('accepted_fg');

    await expectHttpException(
      controller.updateLocationTrackingConsent({ consent: 'deferred' }),
      HttpStatus.BAD_REQUEST,
      {
        success: false,
        error:
          'Cannot transition location_tracking_consent from accepted_fg to deferred',
      }
    );
    expect(
      hasuraSystemService.updateAgentLocationConsent
    ).not.toHaveBeenCalled();
  });

  it('blocks non-agent users before reading consent', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      id: 'user-1',
      user_type_id: 'client',
      client: { id: 'client-1' },
      personas: ['client'],
    });

    await expectHttpException(
      controller.updateLocationTrackingConsent({ consent: 'accepted_fg' }),
      HttpStatus.FORBIDDEN,
      { success: false, error: 'User is not an agent' }
    );
    expect(hasuraSystemService.getAgentLocationConsent).not.toHaveBeenCalled();
    expect(
      hasuraSystemService.updateAgentLocationConsent
    ).not.toHaveBeenCalled();
  });

  it('returns not found when the consent update does not return an agent', async () => {
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue('deferred');
    hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(null);

    await expectHttpException(
      controller.updateLocationTrackingConsent({ consent: 'rejected' }),
      HttpStatus.NOT_FOUND,
      { success: false, error: 'Agent not found or could not be updated' }
    );
  });

  it('resets disclosure when the current consent can return to not_shown', async () => {
    const agent = { id: 'agent-1', location_tracking_consent: 'not_shown' };
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue('rejected');
    hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(agent);

    await expect(controller.resetLocationTrackingDisclosure()).resolves.toEqual({
      success: true,
      agent,
    });
    expect(hasuraSystemService.updateAgentLocationConsent).toHaveBeenCalledWith(
      'agent-1',
      'not_shown'
    );
  });

  it('rejects disclosure reset from accepted consent without mutating Hasura', async () => {
    const current: AgentLocationTrackingConsent = 'accepted_fg';
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue(current);

    await expectHttpException(
      controller.resetLocationTrackingDisclosure(),
      HttpStatus.BAD_REQUEST,
      {
        success: false,
        error:
          'Cannot transition location_tracking_consent from accepted_fg to not_shown',
      }
    );
    expect(
      hasuraSystemService.updateAgentLocationConsent
    ).not.toHaveBeenCalled();
  });
});
