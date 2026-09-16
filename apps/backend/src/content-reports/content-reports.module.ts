import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { RbacModule } from '../rbac/rbac.module';
import { ContentReportsController } from './content-reports.controller';
import { ContentReportsService } from './content-reports.service';

@Module({
  imports: [HasuraModule, AuthModule, AdminAuthModule, RbacModule],
  controllers: [ContentReportsController],
  providers: [ContentReportsService],
  exports: [ContentReportsService],
})
export class ContentReportsModule {}
