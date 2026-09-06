import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { RecipientsController } from './recipients.controller';
import { RecipientsService } from './recipients.service';

@Module({
  imports: [HasuraModule],
  controllers: [RecipientsController],
  providers: [RecipientsService],
  exports: [RecipientsService],
})
export class RecipientsModule {}
