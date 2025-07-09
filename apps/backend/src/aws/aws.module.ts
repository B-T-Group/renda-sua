import { Module } from '@nestjs/common';
import { AwsSecretsManagerService } from './aws-secrets-manager.service';
import { AwsController } from './aws.controller';
import { AwsService } from './aws.service';

@Module({
  controllers: [AwsController],
  providers: [AwsService, AwsSecretsManagerService],
  exports: [AwsService, AwsSecretsManagerService],
})
export class AwsModule {}
