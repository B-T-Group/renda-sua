import { Module } from '@nestjs/common';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { HasuraModule } from '../hasura/hasura.module';
import { DeliveryAvailabilityService } from './delivery-availability.service';
import { DELIVERY_AVAILABILITY_RULES } from './delivery-availability.types';
import { EligibleAgentsQueryService } from './eligible-agents-query.service';
import { AgentInRegionRule } from './rules/agent-in-region.rule';
import { ItemMaxDeliveryDistanceRule } from './rules/item-max-delivery-distance.rule';
import { ServiceAreaEnabledRule } from './rules/service-area-enabled.rule';

/**
 * Delivery availability domain. To add a new availability rule, create an
 * @Injectable() implementing DeliveryAvailabilityRule and append it to the
 * DELIVERY_AVAILABILITY_RULES factory below — no checkout changes required.
 */
@Module({
  imports: [HasuraModule, DeliveryConfigModule],
  providers: [
    EligibleAgentsQueryService,
    ServiceAreaEnabledRule,
    ItemMaxDeliveryDistanceRule,
    AgentInRegionRule,
    {
      provide: DELIVERY_AVAILABILITY_RULES,
      useFactory: (
        serviceArea: ServiceAreaEnabledRule,
        itemMaxDistance: ItemMaxDeliveryDistanceRule,
        agentInRegion: AgentInRegionRule
      ) => [serviceArea, itemMaxDistance, agentInRegion],
      inject: [
        ServiceAreaEnabledRule,
        ItemMaxDeliveryDistanceRule,
        AgentInRegionRule,
      ],
    },
    DeliveryAvailabilityService,
  ],
  exports: [EligibleAgentsQueryService, DeliveryAvailabilityService],
})
export class DeliveryAvailabilityModule {}
