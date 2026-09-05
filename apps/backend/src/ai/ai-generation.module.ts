import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { BedrockLunaService } from './bedrock-luna.service';

/**
 * Slim AI providers only — do not import AuthModule here.
 * AuthModule → AgentsModule → CommissionsModule → NotificationsModule →
 * AssistantModule → AiGenerationModule would otherwise form a circular import
 * that leaves AgentsModule undefined inside AuthModule.
 */
@Module({
  imports: [ConfigModule],
  providers: [BedrockLunaService, AiService],
  exports: [AiService, BedrockLunaService],
})
export class AiGenerationModule {}
