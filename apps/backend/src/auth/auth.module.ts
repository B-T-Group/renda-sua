import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AddressesModule } from '../addresses/addresses.module';
import { AgentsModule } from '../agents/agents.module';
import { BusinessContractsModule } from '../business-contracts/business-contracts.module';
import { BusinessReferralsModule } from '../business-referrals/business-referrals.module';
import { HasuraModule } from '../hasura/hasura.module';
import { AuthGuard } from './auth.guard';
import { Auth0Service } from './auth0.service';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';
import { PermissionService } from './permission.service';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';

@Module({
  imports: [
    ConfigModule,
    HasuraModule,
    AddressesModule,
    AgentsModule,
    BusinessReferralsModule,
    BusinessContractsModule,
  ],
  controllers: [SignupController, LoginController],
  providers: [
    AuthGuard,
    Auth0Service,
    LoginService,
    PermissionService,
    SignupService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [AuthGuard, PermissionService, Auth0Service, SignupService, LoginService],
})
export class AuthModule {}
