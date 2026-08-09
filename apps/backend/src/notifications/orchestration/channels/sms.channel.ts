import { Injectable, Logger } from '@nestjs/common';
import { SmsService } from '../../../sms/sms.service';
import type { ChannelAttemptResult, SmsChannelPayload } from '../notification.types';

@Injectable()
export class SmsChannel {
  private readonly logger = new Logger(SmsChannel.name);

  constructor(private readonly smsService: SmsService) {}

  async send(payload: SmsChannelPayload): Promise<ChannelAttemptResult> {
    try {
      const result = await this.smsService.sendSms({
        to: payload.to,
        message: payload.body,
      });
      if (!result.success) {
        return {
          channel: 'sms',
          status: 'failed',
          error: result.error || 'sms_failed',
        };
      }
      return {
        channel: 'sms',
        status: 'sent',
        providerMessageId: result.transactionId,
      };
    } catch (error: any) {
      this.logger.warn(`SMS send failed: ${error?.message ?? String(error)}`);
      return {
        channel: 'sms',
        status: 'failed',
        error: error?.message ?? String(error),
      };
    }
  }
}
