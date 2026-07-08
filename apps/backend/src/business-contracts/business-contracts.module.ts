import { forwardRef, Module } from '@nestjs/common';
import { AwsModule } from '../aws/aws.module';
import { HasuraModule } from '../hasura/hasura.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BoldsignClientService } from './boldsign-client.service';
import { BusinessContractReconcilerService } from './business-contract-reconciler.service';
import { BusinessContractTemplatesService } from './business-contract-templates.service';
import { BusinessContractsController } from './business-contracts.controller';
import { BusinessContractsDatabaseService } from './business-contracts-database.service';
import { BusinessContractsService } from './business-contracts.service';
import { BusinessContractsWebhookController } from './business-contracts-webhook.controller';

@Module({
  imports: [
    HasuraModule,
    AwsModule,
    NotificationsModule,
    forwardRef(() => MerchantLifecycleModule),
  ],
  controllers: [BusinessContractsController, BusinessContractsWebhookController],
  providers: [
    BoldsignClientService,
    BusinessContractsDatabaseService,
    BusinessContractsService,
    BusinessContractTemplatesService,
    BusinessContractReconcilerService,
  ],
  exports: [BusinessContractsService, BusinessContractTemplatesService],
})
export class BusinessContractsModule {}
