import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AwsModule } from '../aws/aws.module';
import { HasuraModule } from '../hasura/hasura.module';
import { RbacModule } from '../rbac/rbac.module';
import { ReelAiTokensModule } from '../reel-ai-tokens/reel-ai-tokens.module';
import { ReelsModule } from '../reels/reels.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReelAiGenerateController } from './reel-ai-generate.controller';
import { ReelAiGenerateSweeperService } from './reel-ai-generate-sweeper.service';
import { ReelAiGenerateService } from './reel-ai-generate.service';
import { VeoReelClient } from './veo-reel-client';

@Module({
  imports: [
    AuthModule,
    AwsModule,
    HasuraModule,
    RbacModule,
    ReelAiTokensModule,
    ReelsModule,
    NotificationsModule,
  ],
  controllers: [ReelAiGenerateController],
  providers: [
    VeoReelClient,
    ReelAiGenerateService,
    ReelAiGenerateSweeperService,
  ],
  exports: [ReelAiGenerateService],
})
export class ReelAiGenerateModule {}
