import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AddressesModule } from '../addresses/addresses.module';
import { HasuraModule } from '../hasura/hasura.module';
import { AuthGuard } from './auth.guard';
import { Auth0Service } from './auth0.service';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';
import { PermissionService } from './permission.service';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';

@Module({
  imports: [ConfigModule, HasuraModule, forwardRef(() => AddressesModule)],
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
