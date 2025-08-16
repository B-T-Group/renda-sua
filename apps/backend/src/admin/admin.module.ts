import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { AdminMessageService } from './admin-message.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, HasuraModule],
  controllers: [AdminController],
  providers: [AdminMessageService, AdminService],
  exports: [AdminMessageService, AdminService],
})
export class AdminModule {}
