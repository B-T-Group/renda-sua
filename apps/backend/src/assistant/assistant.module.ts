import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { AssistantController } from './assistant.controller';
import { AssistantIdentityService } from './assistant-identity.service';
import { AssistantMarketsCatalogService } from './assistant-markets-catalog.service';
import { AssistantService } from './assistant.service';
import { AssistantToolsService } from './assistant-tools.service';

@Module({
  imports: [AiGenerationModule, ConfigModule],
  controllers: [AssistantController],
  providers: [
    AssistantIdentityService,
    AssistantMarketsCatalogService,
    AssistantToolsService,
    AssistantService,
  ],
  exports: [AssistantService, AssistantIdentityService],
})
export class AssistantModule {}
