import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HasuraModule } from '../hasura/hasura.module';
import { AuthGuard } from './auth.guard';
import { PermissionService } from './permission.service';

@Module({
  imports: [ConfigModule, HasuraModule],
  providers: [
    AuthGuard,
    PermissionService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [AuthGuard, PermissionService],
})
export class AuthModule {}
