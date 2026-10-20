import { HttpException } from '@nestjs/common';

jest.mock('../commissions/commissions.service', () => ({ CommissionsService: jest.fn() }));
jest.mock('../hasura/hasura-system.service', () => ({ HasuraSystemService: jest.fn() }));
jest.mock('../hasura/hasura-user.service', () => ({ HasuraUserService: jest.fn() }));
jest.mock('./agent-hold.service', () => ({ AgentHoldService: jest.fn() }));
jest.mock('./agent-referrals.service', () => ({ AgentReferralsService: jest.fn() }));

import { emptyRequestContext } from '../auth/request-context';
import { AgentsController } from './agents.controller';

const ctx = emptyRequestContext({
  userId: 'user-1',
  authToken: 'token',
  jwtDefaultRole: 'agent',
  jwtAllowedRoles: ['agent'],
});

function build(user: any) {
  const userSvc = {
    sessionPersonaContext: jest.fn().mockReturnValue({ jwtDefaultRole: 'agent', jwtAllowedRoles: ['agent'] }),
    getUser: jest.fn().mockResolvedValue(user),
    executeMutation: jest.fn().mockRejectedValue(new Error('field not found: auto_withdraw_commissions')),
    executeQuery: jest.fn(),
  };
  const sysSvc = {
    executeMutation: jest
      .fn()
      .mockResolvedValue({ update_agents_by_pk: { id: 'agent-1', auto_withdraw_commissions: true } }),
  };
  const c = new AgentsController(userSvc as any, sysSvc as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  return { c, userSvc, sysSvc };
}

describe('#631 H1: PATCH /agents/me/auto-withdraw-commissions', () => {
  const agent = { id: 'user-1', user_type_id: 'agent', personas: ['agent'], agent: { id: 'agent-1' } };

  it('writes through the system client, on the caller own agent row only', async () => {
    const { c, userSvc, sysSvc } = build(agent);
    const r: any = await c.setAutoWithdrawCommissions(ctx, { auto_withdraw_commissions: true });
    expect(r.success).toBe(true);
    expect(userSvc.executeMutation).not.toHaveBeenCalled();
    expect(sysSvc.executeMutation).toHaveBeenCalledTimes(1);
    const [mutation, vars] = sysSvc.executeMutation.mock.calls[0];
    expect(mutation).toContain('update_agents_by_pk');
    expect(mutation).toContain('auto_withdraw_commissions: $auto');
    expect(vars).toEqual({ id: 'agent-1', auto: true });
  });

  it('a non-agent is refused and nothing is written', async () => {
    const { c, sysSvc } = build({ id: 'user-1', user_type_id: 'client', personas: ['client'], agent: null });
    await expect(c.setAutoWithdrawCommissions(ctx, { auto_withdraw_commissions: true })).rejects.toBeInstanceOf(
      HttpException
    );
    expect(sysSvc.executeMutation).not.toHaveBeenCalled();
  });

  it('opt-out writes false on the session agent, ignoring any other id in the body', async () => {
    const { c, userSvc, sysSvc } = build(agent);
    await c.setAutoWithdrawCommissions(ctx, { auto_withdraw_commissions: false, id: 'other-agent' } as any);
    expect(userSvc.executeMutation).not.toHaveBeenCalled();
    expect(sysSvc.executeMutation.mock.calls[0][1]).toEqual({ id: 'agent-1', auto: false });
  });

  it('an agent acting as client cannot change payouts', async () => {
    const { c, userSvc, sysSvc } = build({ ...agent, personas: ['agent', 'client'] });
    userSvc.sessionPersonaContext.mockReturnValue({
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client', 'agent'],
    });
    await expect(c.setAutoWithdrawCommissions(ctx, { auto_withdraw_commissions: false })).rejects.toMatchObject({
      status: 403,
    });
    expect(sysSvc.executeMutation).not.toHaveBeenCalled();
  });

  it('a missing agent row is 404, not a successful payout change', async () => {
    const { c, sysSvc } = build(agent);
    sysSvc.executeMutation.mockResolvedValue({ update_agents_by_pk: null });
    await expect(c.setAutoWithdrawCommissions(ctx, { auto_withdraw_commissions: false })).rejects.toMatchObject({
      status: 404,
    });
  });
});
