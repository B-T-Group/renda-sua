import { forwardRef, Module } from '@nestjs/common';
import { AwsModule } from '../aws/aws.module';
import { BusinessContractsModule } from '../business-contracts/business-contracts.module';
import { HasuraModule } from '../hasura/hasura.module';
import { AgentContractArtifactsService } from './agent-contract-artifacts.service';
import { AgentContractGateService } from './agent-contract-gate.service';
import { AgentContractProfileService } from './agent-contract-profile.service';
import { AgentContractsController } from './agent-contracts.controller';
import { AgentContractsDatabaseService } from './agent-contracts-database.service';
import { AgentContractsService } from './agent-contracts.service';

@Module({
  imports: [
    HasuraModule,
    AwsModule,
    forwardRef(() => BusinessContractsModule),
  ],
  controllers: [AgentContractsController],
  providers: [
    AgentContractsDatabaseService,
    AgentContractGateService,
    AgentContractProfileService,
    AgentContractArtifactsService,
    AgentContractsService,
  ],
  exports: [AgentContractsService, AgentContractGateService],
})
export class AgentContractsModule {}
