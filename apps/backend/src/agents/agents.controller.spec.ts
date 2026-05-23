import { HttpException, HttpStatus } from '@nestjs/common';
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
      getActivePersonaHeader: jest.fn(),
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

  it('updates consent when the agent moves through an allowed transition', async () => {
    const updatedAgent = { id: 'agent-1', location_tracking_consent: 'accepted_bg' };
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue('deferred');
    hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(updatedAgent);

    await expect(
      controller.updateLocationTrackingConsent({ consent: 'accepted_bg' })
    ).resolves.toEqual({ success: true, agent: updatedAgent });
    expect(hasuraSystemService.updateAgentLocationConsent).toHaveBeenCalledWith(
      'agent-1',
      'accepted_bg'
    );
  });

  it('blocks invalid transitions before writing consent', async () => {
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue('accepted_bg');

    await expect(
      controller.updateLocationTrackingConsent({ consent: 'deferred' })
    ).rejects.toThrow(
      new HttpException(
        {
          success: false,
          error:
            'Cannot transition location_tracking_consent from accepted_bg to deferred',
        },
        HttpStatus.BAD_REQUEST
      )
    );
    expect(hasuraSystemService.updateAgentLocationConsent).not.toHaveBeenCalled();
  });

  it('allows rejected agents to reset disclosure to not_shown', async () => {
    const resetAgent = { id: 'agent-1', location_tracking_consent: 'not_shown' };
    hasuraSystemService.getAgentLocationConsent.mockResolvedValue('rejected');
    hasuraSystemService.updateAgentLocationConsent.mockResolvedValue(resetAgent);

    await expect(controller.resetLocationTrackingDisclosure()).resolves.toEqual({
      success: true,
      agent: resetAgent,
    });
    expect(hasuraSystemService.updateAgentLocationConsent).toHaveBeenCalledWith(
      'agent-1',
      'not_shown'
    );
  });

  it('rejects non-agent actors before reading or writing consent state', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      id: 'user-2',
      user_type_id: 'client',
      personas: ['client'],
      client: { id: 'client-1' },
    });

    await expect(
      controller.updateLocationTrackingConsent({ consent: 'accepted_fg' })
    ).rejects.toThrow(
      new HttpException(
        { success: false, error: 'User is not an agent' },
        HttpStatus.FORBIDDEN
      )
    );
    expect(hasuraSystemService.getAgentLocationConsent).not.toHaveBeenCalled();
    expect(hasuraSystemService.updateAgentLocationConsent).not.toHaveBeenCalled();
  });
});
