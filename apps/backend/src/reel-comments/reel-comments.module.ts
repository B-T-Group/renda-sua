import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { ReelCommentsController } from './reel-comments.controller';
import { ReelCommentsService } from './reel-comments.service';

@Module({
  imports: [AuthModule, HasuraModule],
  controllers: [ReelCommentsController],
  providers: [ReelCommentsService],
  exports: [ReelCommentsService],
})
export class ReelCommentsModule {}
