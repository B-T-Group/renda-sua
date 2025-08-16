import { Module } from '@nestjs/common';
import { Auth0Service } from '../auth/auth0.service';
import { PermissionService } from '../auth/permission.service';
import { AwsModule } from '../aws/aws.module';
import { HasuraModule } from '../hasura/hasura.module';
import { UsersController } from './users.controller';

@Module({
  imports: [HasuraModule, AwsModule],
  controllers: [UsersController],
  providers: [Auth0Service, PermissionService],
})
export class UsersModule {}
