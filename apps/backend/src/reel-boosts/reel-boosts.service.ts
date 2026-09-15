import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  BOOST_CREDITS_PER_DAY,
  BOOST_DURATION_HOURS,
  REEL_CREDIT_PACKS,
  getReelCreditPack,
} from './reel-boosts.packs';

@Injectable()
export class ReelBoostsService {
  constructor(private readonly hasura: HasuraSystemService) {}

  listPacks() {
    return REEL_CREDIT_PACKS.map((p) => ({
      id: p.id,
      credits: p.credits,
      prices: p.prices,
    }));
  }

  async getBalance(businessId: string): Promise<number> {
    const res = await this.hasura.executeQuery<{
      businesses_by_pk: { reel_credits: number } | null;
    }>(`query($id:uuid!){businesses_by_pk(id:$id){reel_credits}}`, { id: businessId });
    return res.businesses_by_pk?.reel_credits ?? 0;
  }

  async creditPack(businessId: string, packId: string): Promise<number> {
    const pack = getReelCreditPack(packId);
    if (!pack) throw new BadRequestException('Unknown reel credit pack');
    const res = await this.hasura.executeMutation<{
      update_businesses_by_pk: { reel_credits: number };
    }>(
      `mutation($id:uuid!,$credits:Int!){
        update_businesses_by_pk(pk_columns:{id:$id},_inc:{reel_credits:$credits}){
          reel_credits
        }
      }`,
      { id: businessId, credits: pack.credits }
    );
    await this.logUsage(businessId, null, pack.credits, `purchase:${pack.id}`);
    return res.update_businesses_by_pk.reel_credits;
  }

  async boostReel(userId: string, reelId: string): Promise<void> {
    const businessId = await this.resolveMerchantBusinessId(userId);
    await this.assertOwnedApprovedReel(businessId, reelId);
    const balance = await this.getBalance(businessId);
    if (balance < BOOST_CREDITS_PER_DAY) {
      throw new BadRequestException('Insufficient reel boost credits');
    }
    await this.insertBoostAndDebit(businessId, reelId);
    await this.logUsage(businessId, reelId, BOOST_CREDITS_PER_DAY, 'boost');
  }

  private async assertOwnedApprovedReel(
    businessId: string,
    reelId: string
  ): Promise<void> {
    const res = await this.hasura.executeQuery<{
      reels_by_pk: {
        business_id: string;
        moderation_status: string;
        processing_status: string;
      } | null;
    }>(
      `query($id:uuid!){
        reels_by_pk(id:$id){business_id moderation_status processing_status}
      }`,
      { id: reelId }
    );
    const reel = res.reels_by_pk;
    if (!reel || reel.business_id !== businessId) {
      throw new ForbiddenException('You can only boost your own reels');
    }
    if (reel.moderation_status !== 'approved' || reel.processing_status !== 'ready') {
      throw new BadRequestException('Reel is not eligible to boost');
    }
  }

  private async insertBoostAndDebit(
    businessId: string,
    reelId: string
  ): Promise<void> {
    const now = new Date();
    const ends = new Date(now.getTime() + BOOST_DURATION_HOURS * 60 * 60 * 1000);
    await this.hasura.executeMutation(
      `mutation($businessId:uuid!,$reelId:uuid!,$starts:timestamptz!,$ends:timestamptz!,$credits:Int!){
        insert_reel_boosts_one(object:{
          business_id:$businessId,reel_id:$reelId,starts_at:$starts,ends_at:$ends,credits_spent:$credits
        }){id}
      }`,
      {
        businessId,
        reelId,
        starts: now.toISOString(),
        ends: ends.toISOString(),
        credits: BOOST_CREDITS_PER_DAY,
      }
    );
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$credits:Int!){
        update_businesses_by_pk(pk_columns:{id:$id},_inc:{reel_credits:-$credits}){id}
      }`,
      { id: businessId, credits: BOOST_CREDITS_PER_DAY }
    );
  }

  private async resolveMerchantBusinessId(userId: string): Promise<string> {
    const res = await this.hasura.executeQuery<{
      businesses: Array<{ id: string }>;
    }>(
      `query($userId:uuid!){businesses(where:{user_id:{_eq:$userId}},limit:1){id}}`,
      { userId }
    );
    const id = res.businesses?.[0]?.id;
    if (!id) throw new BadRequestException('Business not found');
    return id;
  }

  private async logUsage(
    businessId: string,
    reelId: string | null,
    credits: number,
    reason: string
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation($object:business_reel_credit_usage_insert_input!){
        insert_business_reel_credit_usage_one(object:$object){id}
      }`,
      { object: { business_id: businessId, reel_id: reelId, credits, reason } }
    );
  }
}
