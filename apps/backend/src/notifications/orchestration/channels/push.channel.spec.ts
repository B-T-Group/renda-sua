import { PushChannel } from './push.channel';

describe('PushChannel', () => {
  it('sends interruptible merchant order pushes with high priority and sound', async () => {
    const notificationsService = {
      sendInternalPushByUserId: jest.fn().mockResolvedValue({
        success: true,
        webSent: 0,
        expoSent: 1,
      }),
    };
    const channel = new PushChannel(notificationsService as never);

    await channel.send('user-1', {
      title: 'New order',
      body: 'Order 1001',
      interruptible: true,
      data: { event: 'order_created' },
    });

    expect(notificationsService.sendInternalPushByUserId).toHaveBeenCalledWith(
      'user-1',
      'New order',
      'Order 1001',
      { event: 'order_created' },
      { priority: 'high', sound: 'default', channelId: 'order_incoming' }
    );
  });

  it('omits Expo interrupt options for non-interruptible pushes', async () => {
    const notificationsService = {
      sendInternalPushByUserId: jest.fn().mockResolvedValue({
        success: true,
        webSent: 1,
        expoSent: 0,
      }),
    };
    const channel = new PushChannel(notificationsService as never);

    await channel.send('user-1', {
      title: 'Update',
      body: 'Status changed',
    });

    expect(notificationsService.sendInternalPushByUserId).toHaveBeenCalledWith(
      'user-1',
      'Update',
      'Status changed',
      undefined,
      undefined
    );
  });
});
