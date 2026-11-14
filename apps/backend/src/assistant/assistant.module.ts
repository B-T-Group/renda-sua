import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { SiteEventsModule } from '../site-events/site-events.module';
import { AssistantController } from './assistant.controller';
import { AssistantRentalCronService } from './assistant-rental-cron.service';
import { AssistantRentalService } from './assistant-rental.service';
import { AssistantIdentityService } from './assistant-identity.service';
import { AssistantMarketsCatalogService } from './assistant-markets-catalog.service';
import { AssistantService } from './assistant.service';
import { AssistantToolsService } from './assistant-tools.service';

@Module({
  imports: [
    AiGenerationModule,
    ConfigModule,
    AppConfigModule,
    SiteEventsModule,
    // Lazy require avoids TDZ: Auth -> Agents -> Commissions -> Notifications
    // -> Assistant -> Rentals -> ImageValidation -> Auth.
    forwardRef(() => require('../rentals/rentals.module').RentalsModule),
  ],
  controllers: [AssistantController],
  providers: [
    AssistantIdentityService,
    AssistantMarketsCatalogService,
    AssistantToolsService,
    AssistantRentalService,
    AssistantRentalCronService,
    AssistantService,
  ],
  exports: [AssistantService, AssistantIdentityService],
})
export class AssistantModule {}
