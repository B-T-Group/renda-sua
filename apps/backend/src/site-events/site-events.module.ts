import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { SiteEventsController } from './site-events.controller';
import { SiteEventsService } from './site-events.service';

@Module({
  imports: [HasuraModule],
  controllers: [SiteEventsController],
  providers: [SiteEventsService],
})
export class SiteEventsModule {}
