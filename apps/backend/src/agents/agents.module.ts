import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { HasuraModule } from '../hasura/hasura.module';

@Module({
  imports: [HasuraModule],
  controllers: [AgentsController],
})
export class AgentsModule {}
