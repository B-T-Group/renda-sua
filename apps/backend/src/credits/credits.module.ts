import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { AdminCreditsController } from './admin-credits.controller';
import { CreditsQueuesService } from './credits-queues.service';
import { CreditsService } from './credits.service';

@Module({
  imports: [HasuraModule, AdminAuthModule],
  controllers: [AdminCreditsController],
  providers: [CreditsService, CreditsQueuesService],
  exports: [CreditsService, CreditsQueuesService],
})
export class CreditsModule {}
