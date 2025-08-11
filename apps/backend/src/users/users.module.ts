import { Module } from '@nestjs/common';
import { Auth0Service } from '../auth/auth0.service';
import { HasuraModule } from '../hasura/hasura.module';
import { UsersController } from './users.controller';

@Module({
  imports: [HasuraModule],
  controllers: [UsersController],
  providers: [Auth0Service],
})
export class UsersModule {}
