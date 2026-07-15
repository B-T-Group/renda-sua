import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AwsModule } from '../aws/aws.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadService } from './upload.service';

@Module({
  imports: [HasuraModule, AwsModule, AuthModule, NotificationsModule],
  providers: [UploadService],
  exports: [UploadService],
})
export class ServicesModule {}
