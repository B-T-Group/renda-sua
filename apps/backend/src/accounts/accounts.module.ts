import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { HasuraModule } from '../hasura/hasura.module';

@Module({
  imports: [HasuraModule],
  controllers: [AccountsController],
})
export class AccountsModule {} 