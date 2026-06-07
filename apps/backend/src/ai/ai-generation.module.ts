import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AiService } from './ai.service';
import { DeepseekService } from './deepseek.service';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [DeepseekService, AiService],
  exports: [AiService, DeepseekService],
})
export class AiGenerationModule {}
