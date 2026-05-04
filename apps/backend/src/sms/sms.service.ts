import { Injectable } from '@nestjs/common';
import { OrangeSmsService } from './providers/orange-sms.service';
import type { SendSmsParams, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class SmsService {
  constructor(private readonly orangeSms: OrangeSmsService) {}

  async sendSms(params: SendSmsParams): Promise<SmsSendResult> {
    return this.orangeSms.sendSms(params);
  }
}
