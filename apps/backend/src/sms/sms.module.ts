import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MtnSmsService } from './providers/mtn-sms.service';
import { OrangeSmsService } from './providers/orange-sms.service';
import { SmsService } from './sms.service';

@Module({
  imports: [ConfigModule],
  providers: [OrangeSmsService, MtnSmsService, SmsService],
  exports: [SmsService, OrangeSmsService, MtnSmsService],
})
export class SmsModule {}
