import { Module } from '@nestjs/common';
import { AwsModule } from '../aws/aws.module';
import { HasuraModule } from '../hasura/hasura.module';
import { UploadService } from './upload.service';

@Module({
  imports: [HasuraModule, AwsModule],
  providers: [UploadService],
  exports: [UploadService],
})
export class ServicesModule {}
