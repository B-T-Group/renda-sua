import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { SiteEventsModule } from '../site-events/site-events.module';
import { ItemRejectionsService } from './item-rejections.service';

/** Leaf module (no feature deps) so admin, AI review, and business items can all import it. */
@Module({
  imports: [HasuraModule, SiteEventsModule],
  providers: [ItemRejectionsService],
  exports: [ItemRejectionsService],
})
export class ItemRejectionsModule {}
