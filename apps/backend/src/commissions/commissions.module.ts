import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { HasuraModule } from '../hasura/hasura.module';
import { CommissionsService } from './commissions.service';

@Module({
  imports: [AccountsModule, HasuraModule],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
