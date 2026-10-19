import { UnauthorizedException } from '@nestjs/common';
import type { HasuraUserService } from '../hasura/hasura-user.service';
import { DedicatedAgentsAgentController } from './dedicated-agents-agent.controller';
import type { DedicatedAssignmentsService } from './dedicated-assignments.service';

describe('DedicatedAgentsAgentController', () => {
  const setup = (userId: string) => {
    const service = {
      listMine: jest.fn(async () => ({ assignments: [] })),
      setOffToday: jest.fn(async () => ({ offToday: true })),
    };
    const controller = new DedicatedAgentsAgentController(
      service as unknown as DedicatedAssignmentsService,
      { getUserId: () => userId } as unknown as HasuraUserService
    );
    return { controller, service };
  };

  it('anonymous callers are 401', async () => {
    const { controller, service } = setup('anonymous');
    await expect(controller.mine()).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.offToday('as-1', { off: true })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.listMine).not.toHaveBeenCalled();
    expect(service.setOffToday).not.toHaveBeenCalled();
  });

  it('acts as the signed-in user only', async () => {
    const { controller, service } = setup('u-agent');
    await controller.mine();
    await controller.offToday('as-1', { off: false });
    expect(service.listMine).toHaveBeenCalledWith('u-agent');
    expect(service.setOffToday).toHaveBeenCalledWith('u-agent', 'as-1', false);
  });
});
