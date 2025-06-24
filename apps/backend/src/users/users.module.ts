import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { HasuraModule } from '../hasura/hasura.module';

@Module({
  imports: [HasuraModule],
  controllers: [UsersController],
})
export class UsersModule {} 