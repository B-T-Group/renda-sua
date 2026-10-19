import { ForbiddenException } from '@nestjs/common';
import { DedicatedAgentsBusinessController } from './dedicated-agents-business.controller';
import type { DedicatedAssignmentsService } from './dedicated-assignments.service';
import type { DedicatedLocationAccessService } from './dedicated-location-access.service';

/** Every business route resolves access for the path's location before the service runs. */
describe('DedicatedAgentsBusinessController', () => {
  const setup = (allowed: boolean) => {
    const service = {
      listForLocation: jest.fn(async () => ({ assignments: [] })),
      setPaused: jest.fn(async () => ({})),
      remove: jest.fn(async () => ({})),
      getPickupSlots: jest.fn(async () => ({ slots: [] })),
      updatePickupSlots: jest.fn(async () => ({ slots: [] })),
    };
    const access = {
      resolve: jest.fn(async (locationId: string) => {
        if (!allowed) throw new ForbiddenException('Missing required delegation permission');
        return { userId: 'u-del', locationId, businessId: 'biz-1', via: 'delegate' };
      }),
    };
    const controller = new DedicatedAgentsBusinessController(
      service as unknown as DedicatedAssignmentsService,
      access as unknown as DedicatedLocationAccessService
    );
    return { controller, service, access };
  };

  const calls = (c: DedicatedAgentsBusinessController) => [
    () => c.list('loc-1'),
    () => c.setStatus('loc-1', 'as-1', { status: 'paused' }),
    () => c.remove('loc-1', 'as-1', { reason: 'r' }),
    () => c.pickupSlots('loc-1'),
    () => c.updatePickupSlots('loc-1', { slots: [{ slotKey: 'morning', isEnabled: false }], confirmPauseAgents: true }),
  ];

  it('denied access (e.g. delegate without delegation.dedicated_agents.manage) is 403 on every route, service untouched', async () => {
    const { controller, service, access } = setup(false);
    for (const call of calls(controller)) await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.resolve).toHaveBeenCalledTimes(5);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });

  it('allowed: the acting user and the path location are passed through', async () => {
    const { controller, service } = setup(true);
    for (const call of calls(controller)) await call();
    expect(service.setPaused).toHaveBeenCalledWith({ userId: 'u-del', locationId: 'loc-1' }, 'as-1', true);
    expect(service.remove).toHaveBeenCalledWith({ userId: 'u-del', locationId: 'loc-1' }, 'as-1', 'r');
    expect(service.updatePickupSlots).toHaveBeenCalledWith(
      { userId: 'u-del', locationId: 'loc-1' },
      { slots: [{ slotKey: 'morning', isEnabled: false }], confirmPauseAgents: true }
    );
  });
});
