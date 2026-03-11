import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { AdminMessageService } from './admin-message.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ApplicationSetupService } from './application-setup.service';
import { CountryOnboardingService } from './country-onboarding.service';
import { ConfigurationsController } from './configurations.controller';
import { ConfigurationsService } from './configurations.service';

@Module({
  imports: [AuthModule, HasuraModule],
  controllers: [AdminController, ConfigurationsController],
  providers: [
    AdminMessageService,
    AdminService,
    ConfigurationsService,
    ApplicationSetupService,
    CountryOnboardingService,
  ],
  exports: [
    AdminMessageService,
    AdminService,
    ConfigurationsService,
    ApplicationSetupService,
    CountryOnboardingService,
  ],
})
export class AdminModule {}
