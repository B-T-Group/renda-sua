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

import { emptyRequestContext } from '../auth/request-context';
import { AgentsController } from './agents.controller';

describe('AgentsController updateMyFocus', () => {
  let controller: AgentsController;
  let hasuraUserService: {
    sessionPersonaContext: jest.Mock;
    getUser: jest.Mock;
  };
  let hasuraSystemService: {
    countAgentActiveOrders: jest.Mock;
    updateAgentFocus: jest.Mock;
  };

  const agentUser = {
    id: 'user-1',
    user_type_id: 'agent',
    personas: ['agent'],
    agent: { id: 'agent-1' },
  };

  const agentCtx = emptyRequestContext({
    userId: 'user-1',
    authToken: 'token',
    jwtDefaultRole: 'agent',
    jwtAllowedRoles: ['agent'],
  });

  beforeEach(() => {
    hasuraUserService = {
      sessionPersonaContext: jest.fn().mockReturnValue({
        jwtDefaultRole: 'agent',
        jwtAllowedRoles: ['agent'],
      }),
      getUser: jest.fn().mockResolvedValue(agentUser),
    };
    hasuraSystemService = {
      countAgentActiveOrders: jest.fn().mockResolvedValue(0),
      updateAgentFocus: jest.fn().mockResolvedValue({
        id: 'agent-1',
        focus: 'commercial',
        is_available: false,
      }),
    };
    controller = new AgentsController(
      hasuraUserService as any,
      hasuraSystemService as any,
      {} as any,
      {} as any,
      {} as any
    );
  });

  it('rejects invalid focus values', async () => {
    try {
      await controller.updateMyFocus(agentCtx, { focus: 'recruiting' as any });
      throw new Error('Expected updateMyFocus to throw');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.getResponse()).toEqual({
        success: false,
        error: 'Invalid focus',
      });
    }
    expect(hasuraSystemService.updateAgentFocus).not.toHaveBeenCalled();
  });

  it('goes offline when switching to commercial with no active orders', async () => {
    hasuraSystemService.countAgentActiveOrders.mockResolvedValue(0);

    await expect(
      controller.updateMyFocus(agentCtx, { focus: 'commercial' })
    ).resolves.toEqual({
      success: true,
      agent: {
        id: 'agent-1',
        focus: 'commercial',
        is_available: false,
      },
    });

    expect(hasuraSystemService.countAgentActiveOrders).toHaveBeenCalledWith(
      'agent-1'
    );
    expect(hasuraSystemService.updateAgentFocus).toHaveBeenCalledWith(
      'agent-1',
      'commercial',
      true
    );
  });

  it('keeps availability when commercial focus still has active orders', async () => {
    hasuraSystemService.countAgentActiveOrders.mockResolvedValue(2);
    hasuraSystemService.updateAgentFocus.mockResolvedValue({
      id: 'agent-1',
      focus: 'commercial',
      is_available: true,
    });

    await controller.updateMyFocus(agentCtx, { focus: 'commercial' });

    expect(hasuraSystemService.updateAgentFocus).toHaveBeenCalledWith(
      'agent-1',
      'commercial',
      false
    );
  });

  it('does not force offline for delivery or both focus', async () => {
    hasuraSystemService.updateAgentFocus.mockResolvedValue({
      id: 'agent-1',
      focus: 'delivery',
      is_available: true,
    });

    await controller.updateMyFocus(agentCtx, { focus: 'delivery' });
    expect(hasuraSystemService.countAgentActiveOrders).not.toHaveBeenCalled();
    expect(hasuraSystemService.updateAgentFocus).toHaveBeenCalledWith(
      'agent-1',
      'delivery',
      false
    );

    await controller.updateMyFocus(agentCtx, { focus: 'both' });
    expect(hasuraSystemService.updateAgentFocus).toHaveBeenLastCalledWith(
      'agent-1',
      'both',
      false
    );
  });

  it('forbids focus updates from non-agent personas', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      id: 'user-1',
      user_type_id: 'client',
      personas: ['client'],
      client: { id: 'client-1' },
    });
    hasuraUserService.sessionPersonaContext.mockReturnValue({
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client'],
    });

    try {
      await controller.updateMyFocus(agentCtx, { focus: 'delivery' });
      throw new Error('Expected updateMyFocus to throw');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
    expect(hasuraSystemService.updateAgentFocus).not.toHaveBeenCalled();
  });
});
