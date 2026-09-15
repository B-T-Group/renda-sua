import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

const COMMENTS_PER_USER_PER_HOUR = 30;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const WHATSAPP_RE = /(wa\.me|whatsapp|whats\s*app)/i;

export type ReelCommentRow = {
  id: string;
  reel_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  is_hidden: boolean;
  is_pinned: boolean;
  created_at: string;
};

@Injectable()
export class ReelCommentsService {
  constructor(private readonly hasura: HasuraSystemService) {}

  stripContactInfo(body: string): string {
    return body
      .replace(EMAIL_RE, '[removed]')
      .replace(PHONE_RE, '[removed]')
      .replace(WHATSAPP_RE, '[removed]')
      .trim();
  }

  async list(reelId: string): Promise<ReelCommentRow[]> {
    const res = await this.hasura.executeQuery<{ reel_comments: ReelCommentRow[] }>(
      `query($reelId:uuid!){
        reel_comments(
          where:{reel_id:{_eq:$reelId},is_hidden:{_eq:false},moderation_status:{_eq:visible}}
          order_by:[{is_pinned:desc},{created_at:asc}]
          limit:100
        ){id reel_id user_id parent_comment_id body is_hidden is_pinned created_at}
      }`,
      { reelId }
    );
    return res.reel_comments ?? [];
  }

  async create(userId: string, reelId: string, body: string): Promise<ReelCommentRow> {
    await this.assertRateLimit(userId);
    const sanitized = this.stripContactInfo(body);
    if (!sanitized || sanitized.length < 1) {
      throw new BadRequestException('Comment cannot be empty');
    }
    const res = await this.hasura.executeMutation<{
      insert_reel_comments_one: ReelCommentRow;
    }>(
      `mutation($object:reel_comments_insert_input!){
        insert_reel_comments_one(object:$object){
          id reel_id user_id parent_comment_id body is_hidden is_pinned created_at
        }
      }`,
      { object: { reel_id: reelId, user_id: userId, body: sanitized } }
    );
    await this.hasura.executeMutation(
      `mutation($id:uuid!){update_reels_by_pk(pk_columns:{id:$id},_inc:{comment_count:1}){id}}`,
      { id: reelId }
    );
    return res.insert_reel_comments_one;
  }

  async hideForMerchant(userId: string, commentId: string): Promise<void> {
    const reel = await this.loadReelForComment(commentId);
    const businessUserId = await this.businessUserId(reel.business_id);
    if (businessUserId !== userId) {
      throw new ForbiddenException('Only the merchant can hide comments on this reel');
    }
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$userId:uuid!){
        update_reel_comments_by_pk(
          pk_columns:{id:$id}
          _set:{is_hidden:true,hidden_by_user_id:$userId,moderation_status:hidden}
        ){id}
      }`,
      { id: commentId, userId }
    );
  }

  private async assertRateLimit(userId: string): Promise<void> {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await this.hasura.executeQuery<{
      reel_comments_aggregate: { aggregate: { count: number } };
    }>(
      `query($userId:uuid!,$since:timestamptz!){
        reel_comments_aggregate(
          where:{user_id:{_eq:$userId},created_at:{_gte:$since}}
        ){aggregate{count}}
      }`,
      { userId, since }
    );
    const count = res.reel_comments_aggregate?.aggregate?.count ?? 0;
    if (count >= COMMENTS_PER_USER_PER_HOUR) {
      throw new HttpException('Comment rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async loadReelForComment(commentId: string): Promise<{ business_id: string }> {
    const res = await this.hasura.executeQuery<{
      reel_comments_by_pk: { reel: { business_id: string } } | null;
    }>(
      `query($id:uuid!){reel_comments_by_pk(id:$id){reel{business_id}}}`,
      { id: commentId }
    );
    const reel = res.reel_comments_by_pk?.reel;
    if (!reel) throw new BadRequestException('Comment not found');
    return reel;
  }

  private async businessUserId(businessId: string): Promise<string | null> {
    const res = await this.hasura.executeQuery<{
      businesses_by_pk: { user_id: string } | null;
    }>(`query($id:uuid!){businesses_by_pk(id:$id){user_id}}`, { id: businessId });
    return res.businesses_by_pk?.user_id ?? null;
  }
}
