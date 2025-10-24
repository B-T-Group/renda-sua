import { Module } from '@nestjs/common';
import { CommissionsModule } from '../commissions/commissions.module';
import { HasuraModule } from '../hasura/hasura.module';
import { AgentsController } from './agents.controller';

@Module({
  imports: [HasuraModule, CommissionsModule],
  controllers: [AgentsController],
})
export class AgentsModule {}
