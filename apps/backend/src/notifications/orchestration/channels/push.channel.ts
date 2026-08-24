import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { NotificationsService } from '../../notifications.service';
import type { ChannelAttemptResult, PushChannelPayload } from '../notification.types';

@Injectable()
export class PushChannel {
  constructor(
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService
  ) {}

  async send(
    userId: string,
    payload: PushChannelPayload
  ): Promise<ChannelAttemptResult> {
    const result = await this.notificationsService.sendInternalPushByUserId(
      userId,
      payload.title,
      payload.body,
      payload.data,
      payload.interruptible
        ? { priority: 'high', sound: 'default', channelId: 'order_incoming' }
        : undefined
    );
    if (!result.success) {
      return {
        channel: 'push',
        status: 'failed',
        error: result.error || 'push_failed',
      };
    }
    const sent = (result.webSent || 0) + (result.expoSent || 0);
    if (sent === 0) {
      return {
        channel: 'push',
        status: 'skipped',
        skippedReason: 'no_devices',
      };
    }
    return {
      channel: 'push',
      status: 'sent',
      providerMessageId: `web:${result.webSent},expo:${result.expoSent}`,
    };
  }
}
