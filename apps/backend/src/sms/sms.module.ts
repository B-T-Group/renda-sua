import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MtnSmsService } from './providers/mtn-sms.service';
import { SmsService } from './sms.service';

@Module({
  imports: [ConfigModule],
  providers: [MtnSmsService, SmsService],
  exports: [SmsService, MtnSmsService],
})
export class SmsModule {}
