import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeCountryCode } from '../business-contracts/merchant-agreement-provider.service';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ReelAiGenerateService } from './reel-ai-generate.service';

const MIN_VIEWS = 5;
const TOP_N = 10;
const AI_REEL_COOLDOWN_DAYS = 30;
const INVENTORY_FETCH_LIMIT = 80;
const DEFAULT_MARKET_COUNTRY = 'CM';

export type AutoReelCandidate = {
  itemId: string;
  businessId: string;
  marketCountry: string;
  viewCount: number;
};

type InventoryViewRow = {
  item_id: string;
  item_view_events_aggregate?: { aggregate?: { count?: number } | null } | null;
  item?: {
    id: string;
    business_id: string;
    is_active: boolean;
    item_images_aggregate?: { aggregate?: { count?: number } | null } | null;
    business?: {
      id: string;
      reels_enabled_allowlist: boolean;
      business_locations?: Array<{
        address?: { country?: string | null } | null;
      }>;
    } | null;
  } | null;
};

@Injectable()
export class ReelAutoGenerateService {
  private readonly logger = new Logger(ReelAutoGenerateService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly config: ConfigService<Configuration>,
    private readonly generateService: ReelAiGenerateService
  ) {}

  async tryCreateDailySponsoredReel(): Promise<AutoReelCandidate | null> {
    if (!this.config.get('reels')?.autoGenerateEnabled) {
      this.logger.log('Auto AI reel skipped: REEL_AUTO_GENERATE_ENABLED is off');
      return null;
    }
    if (await this.hasPlatformSponsoredReelToday()) {
      this.logger.log('Auto AI reel skipped: already created today (UTC)');
      return null;
    }
    const candidate = await this.selectCandidate();
    if (!candidate) {
      this.logger.log('Auto AI reel skipped: no eligible candidate');
      return null;
    }
    return this.startOrSkipOnRace(candidate);
  }

  private async startOrSkipOnRace(
    candidate: AutoReelCandidate
  ): Promise<AutoReelCandidate | null> {
    try {
      await this.startSponsoredGeneration(candidate);
      return candidate;
    } catch (error: any) {
      if (isUniquenessViolation(error)) {
        this.logger.log(
          'Auto AI reel skipped: uniqueness race on platform-sponsored day'
        );
        return null;
      }
      throw error;
    }
  }

  private async startSponsoredGeneration(
    candidate: AutoReelCandidate
  ): Promise<void> {
    this.logger.log(
      `Auto AI reel starting item=${candidate.itemId} business=${candidate.businessId} views=${candidate.viewCount}`
    );
    await this.generateService.generatePlatformSponsored({
      businessId: candidate.businessId,
      subjectId: candidate.itemId,
      marketCountry: candidate.marketCountry,
      presetId: 'dynamic',
      tier: 'fast',
    });
  }

  async selectCandidate(): Promise<AutoReelCandidate | null> {
    const ranked = await this.loadTopViewedItems();
    for (const row of ranked) {
      if (await this.hasRecentAiReel(row.itemId)) {
        this.logger.debug(`Skip item=${row.itemId}: AI reel within ${AI_REEL_COOLDOWN_DAYS}d`);
        continue;
      }
      return row;
    }
    return null;
  }

  async hasPlatformSponsoredReelToday(): Promise<boolean> {
    const since = utcDayStartIso();
    const result = await this.hasura.executeQuery<{
      reels_aggregate: { aggregate: { count: number } | null };
    }>(
      `query($since:timestamptz!){
        reels_aggregate(where:{
          platform_sponsored:{_eq:true}
          deleted_at:{_is_null:true}
          processing_status:{_neq:failed}
          created_at:{_gte:$since}
        }){aggregate{count}}
      }`,
      { since }
    );
    return (result.reels_aggregate?.aggregate?.count ?? 0) > 0;
  }

  private async loadTopViewedItems(): Promise<AutoReelCandidate[]> {
    const rows = await this.fetchInventoryViewRows();
    const byItem = new Map<string, AutoReelCandidate>();
    for (const row of rows) {
      const candidate = this.toCandidate(row);
      if (!candidate) continue;
      const existing = byItem.get(candidate.itemId);
      if (!existing) {
        byItem.set(candidate.itemId, candidate);
        continue;
      }
      existing.viewCount += candidate.viewCount;
    }
    return [...byItem.values()]
      .filter((c) => c.viewCount >= MIN_VIEWS)
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, TOP_N);
  }

  private async fetchInventoryViewRows(): Promise<InventoryViewRow[]> {
    const result = await this.hasura.executeQuery<{
      business_inventory: InventoryViewRow[];
    }>(
      `query($limit:Int!){
        business_inventory(
          where:{
            is_active:{_eq:true}
            item:{is_active:{_eq:true}}
          }
          order_by:{item_view_events_aggregate:{count:desc}}
          limit:$limit
        ){
          item_id
          item_view_events_aggregate{aggregate{count}}
          item{
            id business_id is_active
            item_images_aggregate{aggregate{count}}
            business{
              id reels_enabled_allowlist
              business_locations(
                order_by:[{is_primary:desc},{created_at:asc}]
                limit:1
              ){address{country}}
            }
          }
        }
      }`,
      { limit: INVENTORY_FETCH_LIMIT }
    );
    return result.business_inventory ?? [];
  }

  private toCandidate(row: InventoryViewRow): AutoReelCandidate | null {
    const item = row.item;
    const business = item?.business;
    if (!item?.is_active || !business?.reels_enabled_allowlist) return null;
    const imageCount = Number(
      item.item_images_aggregate?.aggregate?.count ?? 0
    );
    if (imageCount < 1) return null;
    const viewCount = Number(
      row.item_view_events_aggregate?.aggregate?.count ?? 0
    );
    return {
      itemId: item.id,
      businessId: business.id,
      marketCountry: resolveMarketCountry(business.business_locations),
      viewCount,
    };
  }

  private async hasRecentAiReel(itemId: string): Promise<boolean> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - AI_REEL_COOLDOWN_DAYS);
    const result = await this.hasura.executeQuery<{
      reels_aggregate: { aggregate: { count: number } | null };
    }>(
      `query($itemId:uuid!,$since:timestamptz!){
        reels_aggregate(where:{
          subject_type:{_eq:item}
          subject_id:{_eq:$itemId}
          generation_source:{_eq:ai}
          deleted_at:{_is_null:true}
          processing_status:{_neq:failed}
          created_at:{_gte:$since}
        }){aggregate{count}}
      }`,
      { itemId, since: since.toISOString() }
    );
    return (result.reels_aggregate?.aggregate?.count ?? 0) > 0;
  }
}

function utcDayStartIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function resolveMarketCountry(
  locations?: Array<{ address?: { country?: string | null } | null }>
): string {
  const raw = locations?.[0]?.address?.country;
  return normalizeCountryCode(raw) || DEFAULT_MARKET_COUNTRY;
}

function isUniquenessViolation(error: any): boolean {
  const message = String(error?.message ?? error ?? '');
  return (
    message.includes('Uniqueness violation') ||
    message.includes('unique constraint') ||
    message.includes('reels_one_platform_sponsored_per_utc_day')
  );
}
