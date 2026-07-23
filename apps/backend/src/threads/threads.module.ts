import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ThreadsController } from './threads.controller';
import { ThreadsService } from './threads.service';

@Module({
  imports: [HasuraModule, AuthModule, NotificationsModule],
  controllers: [ThreadsController],
  providers: [ThreadsService],
  exports: [ThreadsService],
})
export class ThreadsModule {}
