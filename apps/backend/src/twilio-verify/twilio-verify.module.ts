import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HasuraModule } from '../hasura/hasura.module';
import { TwilioVerifyService } from './twilio-verify.service';
import { TwilioVerifyController } from './twilio-verify.controller';

@Module({
  imports: [ConfigModule, HasuraModule],
  providers: [TwilioVerifyService],
  controllers: [TwilioVerifyController],
  exports: [TwilioVerifyService],
})
export class TwilioVerifyModule {}
