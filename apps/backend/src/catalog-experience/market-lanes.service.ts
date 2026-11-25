import { Injectable, Logger } from '@nestjs/common';
import {
  buildMarketLanesCacheKey,
  MARKET_LANES_TTL_SECONDS,
} from '../catalog-cache/catalog-cache-keys';
import { CatalogCacheService } from '../catalog-cache/catalog-cache.service';
import { FOOD_CATEGORY_NAME } from '../food/food.constants';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { sellableParentStockWhere } from '../item-variants/variant-inventory.service';
import {
  type MarketLaneFlags,
  type MarketLanesResult,
  visibleMarketLanes,
} from './market-lanes.types';

@Injectable()
export class MarketLanesService {
  private readonly logger = new Logger(MarketLanesService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly cache: CatalogCacheService
  ) {}

  getMarketLanes(countryCode: string): Promise<MarketLanesResult> {
    const code = countryCode.trim().toUpperCase();
    return this.cache.getOrCompute(
      buildMarketLanesCacheKey(code),
      () => this.compute(code),
      { ttlSeconds: MARKET_LANES_TTL_SECONDS }
    );
  }

  private async compute(code: string): Promise<MarketLanesResult> {
    const [deliveryOn, exportOn] = await Promise.all([
      this.hasDeliveryMarket(code),
      this.hasActiveExportMarket(code),
    ]);
    const [food, exports] = await Promise.all([
      deliveryOn ? this.hasFoodInventory(code) : false,
      exportOn ? this.hasExportInventory(code) : false,
    ]);
    const lanes: MarketLaneFlags = {
      rentals: true,
      exports,
      shop: true,
      food,
    };
    return { country_code: code, lanes, visible: visibleMarketLanes(lanes) };
  }

  private async hasDeliveryMarket(code: string): Promise<boolean> {
    return this.countryStateExists({
      service_status: { _eq: 'active' },
      delivery_enabled: { _eq: true },
      country_code: { _eq: code },
    });
  }

  private async hasActiveExportMarket(code: string): Promise<boolean> {
    return this.countryStateExists({
      service_status: { _eq: 'active' },
      country_code: { _eq: code },
    });
  }

  private async countryStateExists(
    where: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const response = await this.hasura.executeQuery(
        `query MarketLanesCountryState($where: supported_country_states_bool_exp!) {
          supported_country_states(where: $where, limit: 1) { id }
        }`,
        { where }
      );
      return (response.supported_country_states || []).length > 0;
    } catch (error: any) {
      this.logger.warn(`Market lanes country check failed: ${error?.message}`);
      return false;
    }
  }

  private async hasFoodInventory(code: string): Promise<boolean> {
    return this.inventoryExists(
      {
        _and: [
          { is_active: { _eq: true } },
          { item_variant_id: { _is_null: true } },
          sellableParentStockWhere,
          {
            business_location: {
              is_active: { _eq: true },
              business: { is_storefront_visible: { _eq: true } },
              address: { country: { _eq: code } },
            },
          },
          {
            item: {
              moderation_status: { _eq: 'approved' },
              export_available: { _eq: false },
              item_sub_category: {
                item_category: { name: { _eq: FOOD_CATEGORY_NAME } },
              },
            },
          },
        ],
      },
      'MarketLanesFood'
    );
  }

  private async hasExportInventory(code: string): Promise<boolean> {
    return this.inventoryExists(
      {
        _and: [
          { is_active: { _eq: true } },
          { item_variant_id: { _is_null: true } },
          sellableParentStockWhere,
          {
            business_location: {
              is_active: { _eq: true },
              business: { is_storefront_visible: { _eq: true } },
            },
          },
          {
            item: {
              moderation_status: { _eq: 'approved' },
              export_available: { _eq: true },
              export_markets: { country_code: { _eq: code } },
            },
          },
        ],
      },
      'MarketLanesExports'
    );
  }

  private async inventoryExists(
    where: Record<string, unknown>,
    queryName: string
  ): Promise<boolean> {
    try {
      const response = await this.hasura.executeQuery(
        `query ${queryName}($where: business_inventory_bool_exp!) {
          business_inventory_aggregate(where: $where) {
            aggregate { count }
          }
        }`,
        { where }
      );
      const count =
        response.business_inventory_aggregate?.aggregate?.count ?? 0;
      return count > 0;
    } catch (error: any) {
      this.logger.warn(`${queryName} failed: ${error?.message}`);
      return false;
    }
  }
}
