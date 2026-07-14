import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { Auth0Service } from '../auth/auth0.service';
import { AwsModule } from '../aws/aws.module';
import { AgentsModule } from '../agents/agents.module';
import { BusinessReferralsModule } from '../business-referrals/business-referrals.module';
import { BusinessContractsModule } from '../business-contracts/business-contracts.module';
import { HasuraModule } from '../hasura/hasura.module';
import { RbacModule } from '../rbac/rbac.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { AccountDeletionService } from './account-deletion.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    HasuraModule,
    RbacModule,
    AwsModule,
    AddressesModule,
    AgentsModule,
    BusinessReferralsModule,
    BusinessContractsModule,
    StripePaymentsModule,
  ],
  controllers: [UsersController],
  providers: [Auth0Service, AccountDeletionService],
})
export class UsersModule {}
