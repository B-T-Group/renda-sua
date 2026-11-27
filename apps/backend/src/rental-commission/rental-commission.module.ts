import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { AdminRentalCommissionController } from './admin-rental-commission.controller';
import { RentalCommissionController } from './rental-commission.controller';
import { RentalCommissionService } from './rental-commission.service';
import { RentalCommissionRulesService } from './rental-commission-rules.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [RentalCommissionController, AdminRentalCommissionController],
  providers: [RentalCommissionService, RentalCommissionRulesService],
  exports: [RentalCommissionService, RentalCommissionRulesService],
})
export class RentalCommissionModule {}
