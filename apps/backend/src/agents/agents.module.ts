import { Module } from '@nestjs/common';
import { CommissionsModule } from '../commissions/commissions.module';
import { HasuraModule } from '../hasura/hasura.module';
import { AgentHoldService } from './agent-hold.service';
import { AgentsController } from './agents.controller';

@Module({
  imports: [HasuraModule, CommissionsModule],
  controllers: [AgentsController],
  providers: [AgentHoldService],
  exports: [AgentHoldService],
})
export class AgentsModule {}
