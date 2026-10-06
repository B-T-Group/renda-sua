import { Module } from '@nestjs/common';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { HasuraModule } from '../hasura/hasura.module';
import { SiteEventsModule } from '../site-events/site-events.module';
import { DeliveryAvailabilityService } from './delivery-availability.service';
import { DELIVERY_AVAILABILITY_RULES } from './delivery-availability.types';
import { EligibleAgentsQueryService } from './eligible-agents-query.service';
import { AgentInRegionRule } from './rules/agent-in-region.rule';
import { FeeDerivedRangeRule } from './rules/fee-derived-range.rule';
import { ItemMaxDeliveryDistanceRule } from './rules/item-max-delivery-distance.rule';
import { ServiceAreaEnabledRule } from './rules/service-area-enabled.rule';

/**
 * Delivery availability domain. To add a new availability rule, create an
 * @Injectable() implementing DeliveryAvailabilityRule and append it to the
 * DELIVERY_AVAILABILITY_RULES factory below — no checkout changes required.
 */
@Module({
  imports: [HasuraModule, DeliveryConfigModule, SiteEventsModule],
  providers: [
    EligibleAgentsQueryService,
    ServiceAreaEnabledRule,
    ItemMaxDeliveryDistanceRule,
    FeeDerivedRangeRule,
    AgentInRegionRule,
    {
      provide: DELIVERY_AVAILABILITY_RULES,
      useFactory: (
        serviceArea: ServiceAreaEnabledRule,
        itemMaxDistance: ItemMaxDeliveryDistanceRule,
        feeDerivedRange: FeeDerivedRangeRule,
        agentInRegion: AgentInRegionRule
      ) => [serviceArea, itemMaxDistance, feeDerivedRange, agentInRegion],
      inject: [
        ServiceAreaEnabledRule,
        ItemMaxDeliveryDistanceRule,
        FeeDerivedRangeRule,
        AgentInRegionRule,
      ],
    },
    DeliveryAvailabilityService,
  ],
  exports: [EligibleAgentsQueryService, DeliveryAvailabilityService],
})
export class DeliveryAvailabilityModule {}
