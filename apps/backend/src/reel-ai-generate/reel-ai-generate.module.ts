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
import { GoogleVideoGenerationProvider } from './video-generation/providers/google-video-generation.provider';
import { RunwayReelClient } from './video-generation/providers/runway-reel-client';
import { RunwayVideoGenerationProvider } from './video-generation/providers/runway-video-generation.provider';
import { VideoGenerationRouter } from './video-generation/video-generation-router.service';

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
    RunwayReelClient,
    GoogleVideoGenerationProvider,
    RunwayVideoGenerationProvider,
    VideoGenerationRouter,
    ReelAiGenerateService,
    ReelAiGenerateSweeperService,
  ],
  exports: [ReelAiGenerateService],
})
export class ReelAiGenerateModule {}
