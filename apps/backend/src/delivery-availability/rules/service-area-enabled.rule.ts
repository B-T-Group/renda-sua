import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import {
  DeliveryAvailabilityContext,
  DeliveryAvailabilityRule,
  DeliveryAvailabilityRuleOutcome,
  DeliveryUnavailableReason,
} from '../delivery-availability.types';

interface SupportedStateRow {
  state_name: string | null;
  delivery_enabled: boolean;
}

const SERVICE_AREA_QUERY = `
  query DeliveryServiceArea($countryCode: bpchar!) {
    supported_country_states(where: { country_code: { _eq: $countryCode } }) {
      state_name
      delivery_enabled
    }
  }
`;

/**
 * Blocks delivery when ops has explicitly disabled delivery for the seller's
 * region via supported_country_states.delivery_enabled. Regions without a row
 * are not blocked here (country onboarding gates handle unsupported regions).
 */
@Injectable()
export class ServiceAreaEnabledRule implements DeliveryAvailabilityRule {
  readonly id = 'service-area-enabled';
  /** Cheap data check — runs before the agent proximity scan. */
  readonly order = 50;

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async evaluate(
    ctx: DeliveryAvailabilityContext
  ): Promise<DeliveryAvailabilityRuleOutcome> {
    const countryCode = ctx.sellerCountry?.trim().toUpperCase();
    if (!countryCode) return { pass: true };

    const result = await this.hasuraSystemService.executeQuery(
      SERVICE_AREA_QUERY,
      { countryCode }
    );
    const rows = (result?.supported_country_states ??
      []) as SupportedStateRow[];
    if (rows.length === 0) return { pass: true };

    const sellerState = ctx.sellerState?.trim().toLowerCase();
    const stateRow = sellerState
      ? rows.find((r) => (r.state_name ?? '').trim().toLowerCase() === sellerState)
      : undefined;

    // Prefer the exact state row; fall back to "any state allows delivery"
    // when the seller state has no dedicated row.
    const deliveryEnabled = stateRow
      ? stateRow.delivery_enabled
      : rows.some((r) => r.delivery_enabled);

    if (!deliveryEnabled) {
      return {
        pass: false,
        reason: DeliveryUnavailableReason.SERVICE_AREA_DISABLED,
        metadata: {
          countryCode,
          sellerState: ctx.sellerState ?? null,
          matchedStateRow: !!stateRow,
        },
      };
    }

    return { pass: true };
  }
}
