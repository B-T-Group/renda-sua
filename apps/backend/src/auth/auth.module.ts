import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HasuraModule } from '../hasura/hasura.module';
import { AuthGuard } from './auth.guard';
import { Auth0Service } from './auth0.service';
import { PermissionService } from './permission.service';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';

@Module({
  imports: [ConfigModule, HasuraModule],
  controllers: [SignupController],
  providers: [
    AuthGuard,
    Auth0Service,
    PermissionService,
    SignupService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [AuthGuard, PermissionService, Auth0Service, SignupService],
})
export class AuthModule {}
