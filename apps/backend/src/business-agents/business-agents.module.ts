import { Module } from '@nestjs/common';
import { BusinessAdminGuard } from '../admin/business-admin.guard';
import { HasuraModule } from '../hasura/hasura.module';
import { BusinessAgentsController } from './business-agents.controller';

@Module({
  imports: [HasuraModule],
  controllers: [BusinessAgentsController],
  providers: [BusinessAdminGuard],
})
export class BusinessAgentsModule {}
