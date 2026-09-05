import { Injectable, Logger } from '@nestjs/common';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  calculateDeliveryFeeFallback,
  isCfaDeliveryFallbackCountry,
} from '../orders/delivery-fee-fallback';
import type {
  DeliveryEstimateResponse,
  DeliveryFee,
  DeliveryWindow,
} from './dto/delivery-estimate-response.dto';

interface AreaInfo {
  countryCode: string;
  countryName: string;
  stateName: string;
  isCountryWide: boolean;
}

interface ItemInfo {
  category?: string;
  isFood: boolean;
}

@Injectable()
export class DeliveryEstimateService {
  private readonly logger = new Logger(DeliveryEstimateService.name);

  constructor(
    private readonly hasuraService: HasuraSystemService,
    private readonly deliveryConfigService: DeliveryConfigService
  ) {}

  async getEstimate(params: {
    marketId: string;
    areaId?: string;
    category?: string;
    sellerId?: string;
    skuId?: string;
    qty?: number;
  }): Promise<DeliveryEstimateResponse> {
    const areaInfo = await this.resolveArea(params.marketId, params.areaId);
    const itemInfo = await this.resolveItemInfo(
      params.category,
      params.skuId
    );

    const currency = await this.deliveryConfigService.getCurrency(
      areaInfo.countryCode
    );

    const window = await this.estimateWindow(areaInfo, itemInfo);
    const fee = await this.estimateFee(areaInfo, itemInfo, params.qty ?? 1);
    const servingStatus = itemInfo.isFood
      ? await this.getServingStatus(params.sellerId, areaInfo.countryCode)
      : null;

    const coverage: 'in' | 'out' = 'in';
    const trustVariant: 'map_and_pin' | 'sms_link' | 'app_and_web' = 
      'map_and_pin';

    return {
      areaLabel: this.formatAreaLabel(areaInfo),
      needsFinerArea: areaInfo.isCountryWide,
      window,
      fee: {
        ...fee,
        currency,
      },
      servingStatus,
      coverage,
      trustVariant,
    };
  }

  private async resolveArea(
    marketId: string,
    areaId?: string
  ): Promise<AreaInfo> {
    const query = `
      query ResolveArea($marketId: bpchar!, $areaId: bpchar) {
        markets: countries(where: { country_code: { _eq: $marketId } }) {
          country_code
          country_name
        }
        areas: country_states(
          where: {
            country_code: { _eq: $marketId }
            state_code: { _eq: $areaId }
          }
        ) {
          state_code
          state_name
        }
      }
    `;

    const response = await this.hasuraService.executeQuery(query, {
      marketId,
      areaId: areaId || null,
    });

    const market = response.markets?.[0];
    if (!market) {
      throw new Error(`Market not found: ${marketId}`);
    }

    const area = response.areas?.[0];
    const isCountryWide = !areaId || !area;

    return {
      countryCode: market.country_code,
      countryName: market.country_name,
      stateName: area?.state_name || 'All',
      isCountryWide,
    };
  }

  private async resolveItemInfo(
    category?: string,
    skuId?: string
  ): Promise<ItemInfo> {
    if (!category && !skuId) {
      return { isFood: false };
    }

    if (category) {
      const isFood = this.isFoodCategory(category);
      return { category, isFood };
    }

    if (skuId) {
      const query = `
        query ResolveItem($skuId: uuid!) {
          items_by_pk(id: $skuId) {
            item_sub_category {
              item_category {
                category_name
              }
            }
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query, { skuId });
      const categoryName =
        response.items_by_pk?.item_sub_category?.item_category?.category_name;
      const isFood = this.isFoodCategory(categoryName);

      return {
        category: categoryName,
        isFood,
      };
    }

    return { isFood: false };
  }

  private isFoodCategory(category?: string): boolean {
    if (!category) return false;
    const normalized = category.toLowerCase().trim();
    return (
      normalized === 'food' ||
      normalized === 'food & beverages' ||
      normalized.includes('restaurant')
    );
  }

  private async estimateWindow(
    areaInfo: AreaInfo,
    itemInfo: ItemInfo
  ): Promise<DeliveryWindow> {
    if (itemInfo.isFood) {
      return {
        label: 'Usually arrives',
        band: '45–75 minutes',
        start: null,
        end: null,
      };
    }

    return {
      label: 'Usually arrives',
      band: '24–48 hours',
      start: null,
      end: null,
    };
  }

  private async estimateFee(
    areaInfo: AreaInfo,
    itemInfo: ItemInfo,
    qty: number
  ): Promise<Omit<DeliveryFee, 'currency'>> {
    if (areaInfo.isCountryWide) {
      const baseFee = await this.deliveryConfigService.getNormalDeliveryBaseFee(
        areaInfo.countryCode
      );
      const maxPerKm = await this.deliveryConfigService.getMaxPerKmDeliveryFee(
        areaInfo.countryCode
      );

      const isCfa = isCfaDeliveryFallbackCountry(areaInfo.countryCode);
      const maxFee = isCfa ? 1500 : Math.max(baseFee, maxPerKm);

      return {
        min: baseFee,
        max: maxFee,
        exact: null,
        confidence: 'range',
      };
    }

    const baseFee = await this.deliveryConfigService.getNormalDeliveryBaseFee(
      areaInfo.countryCode
    );

    const estimatedDistance = 10;
    const fallback = calculateDeliveryFeeFallback({
      distanceKm: estimatedDistance,
      countryCode: areaInfo.countryCode,
      requiresFastDelivery: false,
    });

    return {
      min: baseFee,
      max: fallback.totalFee,
      exact: null,
      confidence: 'range',
    };
  }

  private async getServingStatus(
    sellerId?: string,
    countryCode?: string
  ): Promise<string | null> {
    if (!sellerId) return null;

    try {
      const timezone = await this.deliveryConfigService.getTimezone(
        countryCode || 'GA'
      );

      const query = `
        query GetBusinessHours($sellerId: uuid!) {
          business_locations(where: { business_id: { _eq: $sellerId } }) {
            operating_hours
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query, {
        sellerId,
      });

      const location = response.business_locations?.[0];
      if (!location?.operating_hours) {
        return 'Hours not available';
      }

      const now = new Date();
      const currentDay = now
        .toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone })
        .toLowerCase();

      const hours = location.operating_hours as Record<
        string,
        { open: string; close: string; is_open?: boolean }
      >;
      const todayHours = hours[currentDay];

      if (!todayHours || todayHours.is_open === false) {
        return 'Closed today';
      }

      return `Open ${todayHours.open} - ${todayHours.close}`;
    } catch (error: any) {
      this.logger.warn(
        `Failed to get serving status for seller ${sellerId}: ${error?.message}`
      );
      return null;
    }
  }

  private formatAreaLabel(areaInfo: AreaInfo): string {
    const suffix = areaInfo.isCountryWide ? 'All' : areaInfo.stateName;
    return `${areaInfo.countryName} · ${suffix}`;
  }
}
