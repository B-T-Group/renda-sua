import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BusinessAdminGuard } from './business-admin.guard';

@Module({
  imports: [HasuraModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService, BusinessAdminGuard],
})
export class AdminModule {}
