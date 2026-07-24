import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth.module';
import { HasuraModule } from '../../hasura/hasura.module';
import { AccountRechargeController } from './account-recharge.controller';
import { AccountRechargeService } from './account-recharge.service';

@Module({
  imports: [AdminAuthModule, HasuraModule],
  controllers: [AccountRechargeController],
  providers: [AccountRechargeService],
})
export class AccountRechargeModule {}
