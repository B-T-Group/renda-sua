import type { ConfigService } from '@nestjs/config';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { NotificationsService as NotificationsServiceType } from './notifications.service';

// test-setup.ts replaces NotificationsService with an empty class; this spec needs the real one.
const { NotificationsService } = jest.requireActual<{
  NotificationsService: new (...args: unknown[]) => NotificationsServiceType;
}>('./notifications.service');

/** NotificationsService.sendDedicatedAgentNotice: in-app row + push (same pattern as payment-programme notices). */
describe('NotificationsService.sendDedicatedAgentNotice', () => {
  const setup = (pushEnabled: boolean, failInsert = false) => {
    const executeMutation = jest.fn(async () => {
      if (failInsert) throw new Error('db down');
      return { insert_user_messages_one: { id: 'm-1' } };
    });
    const config = { get: jest.fn((key: string) => (key === 'push' ? { enabled: pushEnabled } : undefined)) };
    const none = {} as never;
    const service = new NotificationsService(
      config as unknown as ConfigService,
      { executeMutation } as unknown as HasuraSystemService,
      none,
      none,
      none,
      none,
      none,
      none,
      none
    );
    const push = jest
      .spyOn(service as unknown as { sendPushNotificationByUserId: () => Promise<unknown> }, 'sendPushNotificationByUserId')
      .mockResolvedValue({ webSent: 1, expoSent: 1 });
    return { service, executeMutation, push };
  };
  const params = {
    userId: 'u-1',
    title: 'Dedicated agent',
    body: 'RendaSua assigned Awa to Morning',
    messageType: 'DEDICATED_AGENT_ASSIGNED',
    assignmentId: 'as-1',
    path: '/business/locations/loc-1/dedicated-agents',
    event: 'dedicated_agent_assigned',
    persona: 'business' as const,
    locationId: 'loc-1',
  };

  it('writes the in-app message and sends the push', async () => {
    const { service, executeMutation, push } = setup(true);
    await service.sendDedicatedAgentNotice(params);
    expect(executeMutation).toHaveBeenCalledWith(expect.stringContaining('insert_user_messages_one'), {
      object: {
        user_id: 'u-1',
        entity_type: 'dedicated_agent_assignment',
        entity_id: 'as-1',
        message_type: 'DEDICATED_AGENT_ASSIGNED',
        message: 'RendaSua assigned Awa to Morning',
        message_payload: { path: params.path, event: params.event, persona: 'business', locationId: 'loc-1' },
      },
    });
    expect(push).toHaveBeenCalledWith('u-1', 'Dedicated agent', 'RendaSua assigned Awa to Morning', {
      url: params.path,
      event: params.event,
      persona: 'business',
      assignmentId: 'as-1',
      locationId: 'loc-1',
    });
  });

  it('push off: in-app only', async () => {
    const { service, executeMutation, push } = setup(false);
    await service.sendDedicatedAgentNotice(params);
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('a failed in-app write still pushes and never throws', async () => {
    const { service, push } = setup(true, true);
    await expect(service.sendDedicatedAgentNotice(params)).resolves.toBeUndefined();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('no user: nothing', async () => {
    const { service, executeMutation, push } = setup(true);
    await service.sendDedicatedAgentNotice({ ...params, userId: ' ' });
    expect(executeMutation).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
