import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AddressesModule } from '../addresses/addresses.module';
import { AgentsModule } from '../agents/agents.module';
import { BusinessContractsModule } from '../business-contracts/business-contracts.module';
import { BusinessReferralsModule } from '../business-referrals/business-referrals.module';
import { CreditsModule } from '../credits/credits.module';
import { HasuraModule } from '../hasura/hasura.module';
import { LaunchPromoModule } from '../launch-promo/launch-promo.module';
import { MetaConversionsModule } from '../meta-conversions/meta-conversions.module';
import { MobilePaymentPhoneSeedModule } from '../mobile-payment-phones/mobile-payment-phone-seed.module';
import { RbacModule } from '../rbac/rbac.module';
import { AuthGuard } from './auth.guard';
import { Auth0Service } from './auth0.service';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';
import { PermissionService } from './permission.service';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';
import { SignupAttemptCleanupService } from './signup-attempt-cleanup.service';
import { BusinessProvisioningService } from './provisioning/business-provisioning.service';
import { ReferralProvisioningService } from './provisioning/referral-provisioning.service';
import { UserProvisioningService } from './provisioning/user-provisioning.service';

@Module({
  imports: [
    ConfigModule,
    HasuraModule,
    RbacModule,
    AddressesModule,
    AgentsModule,
    BusinessReferralsModule,
    CreditsModule,
    BusinessContractsModule,
    LaunchPromoModule,
    MobilePaymentPhoneSeedModule,
    MetaConversionsModule,
  ],
  controllers: [SignupController, LoginController],
  providers: [
    AuthGuard,
    Auth0Service,
    LoginService,
    PermissionService,
    SignupService,
    SignupAttemptCleanupService,
    UserProvisioningService,
    BusinessProvisioningService,
    ReferralProvisioningService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [
    AuthGuard,
    PermissionService,
    Auth0Service,
    SignupService,
    LoginService,
    RbacModule,
  ],
})
export class AuthModule {}
