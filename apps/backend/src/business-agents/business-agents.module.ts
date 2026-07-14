import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { BusinessAgentsController } from './business-agents.controller';

@Module({
  imports: [HasuraModule, AdminAuthModule],
  controllers: [BusinessAgentsController],
})
export class BusinessAgentsModule {}
