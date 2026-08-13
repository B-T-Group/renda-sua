import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AiService } from './ai.service';
import { BedrockLunaService } from './bedrock-luna.service';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [BedrockLunaService, AiService],
  exports: [AiService, BedrockLunaService],
})
export class AiGenerationModule {}
