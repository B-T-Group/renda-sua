import { Injectable } from '@nestjs/common';
import { MtnSmsService } from './providers/mtn-sms.service';
import type { SendSmsParams, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class SmsService {
  constructor(private readonly mtnSms: MtnSmsService) {}

  async sendSms(params: SendSmsParams): Promise<SmsSendResult> {
    return this.mtnSms.sendSms(params);
  }
}
