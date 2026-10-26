import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { maskPersonName } from '../common/utils/mask-name.util';
import { AgentReferralsService } from '../agents/agent-referrals.service';
import { BusinessReferralsService } from '../business-referrals/business-referrals.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SIGNUP_AI_TOKENS } from './business-tokens.packs';

export type GiftLookupResult = {
  maskedName: string;
  referralCode: string;
  recipientBusinessId: string;
  recipientUserId: string;
};

export type GiftTransferRow = {
  id: string;
  amount: number;
  sender_business_id: string;
  recipient_business_id: string;
  recipient_user_id: string;
  created_at: string;
  status: string;
};

@Injectable()
export class BusinessTokenGiftsService {
  private readonly logger = new Logger(BusinessTokenGiftsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly businessReferralsService: BusinessReferralsService,
    private readonly agentReferralsService: AgentReferralsService,
    private readonly notificationsService: NotificationsService
  ) {}

  async getGiftableBalance(businessId: string): Promise<{
    ai_tokens: number;
    ai_tokens_nongiftable: number;
    giftable: number;
  }> {
    const row = await this.loadTokenRow(businessId);
    const nongiftable = row.ai_tokens_nongiftable ?? 0;
    const ai_tokens = row.ai_tokens ?? 0;
    return {
      ai_tokens,
      ai_tokens_nongiftable: nongiftable,
      giftable: Math.max(0, ai_tokens - nongiftable),
    };
  }

  async lookupRecipient(
    code: string,
    senderUserId: string,
    senderBusinessId: string
  ): Promise<GiftLookupResult> {
    const resolved = await this.resolveRecipientBusiness(code, senderUserId);
    if (resolved.recipientBusinessId === senderBusinessId) {
      throw new BadRequestException({
        success: false,
        error: 'You cannot send tokens to yourself.',
        code: 'GIFT_SELF',
      });
    }
    return {
      maskedName: resolved.maskedName,
      referralCode: resolved.referralCode,
      recipientBusinessId: resolved.recipientBusinessId,
      recipientUserId: resolved.recipientUserId,
    };
  }

  async sendGift(params: {
    senderBusinessId: string;
    senderUserId: string;
    code: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<{
    transfer: GiftTransferRow;
    balance: { ai_tokens: number; giftable: number };
    recipientMaskedName: string;
  }> {
    const lookup = await this.lookupRecipient(
      params.code,
      params.senderUserId,
      params.senderBusinessId
    );
    const existing = await this.findByIdempotency(
      params.senderBusinessId,
      params.idempotencyKey
    );
    const transfer =
      existing ??
      (await this.executeTransfer({
        ...params,
        recipientBusinessId: lookup.recipientBusinessId,
        recipientUserId: lookup.recipientUserId,
      }));
    if (!existing) {
      const senderMasked = await this.maskedNameForUser(params.senderUserId);
      await this.notifyRecipient({
        recipientUserId: lookup.recipientUserId,
        senderMaskedName: senderMasked,
        amount: params.amount,
        transferId: transfer.id,
      });
    }
    const balance = await this.getGiftableBalance(params.senderBusinessId);
    return {
      transfer,
      balance: { ai_tokens: balance.ai_tokens, giftable: balance.giftable },
      recipientMaskedName: lookup.maskedName,
    };
  }

  private async findByIdempotency(
    senderBusinessId: string,
    idempotencyKey: string
  ): Promise<GiftTransferRow | null> {
    const result = await this.hasuraSystemService.executeQuery(
      `query FindAiTokenGift($businessId: uuid!, $key: String!) {
        ai_token_transfers(
          where: {
            sender_business_id: { _eq: $businessId }
            idempotency_key: { _eq: $key }
          }
          limit: 1
        ) {
          id amount status created_at
          sender_business_id recipient_business_id recipient_user_id
        }
      }`,
      { businessId: senderBusinessId, key: idempotencyKey.trim() }
    );
    return result?.ai_token_transfers?.[0] ?? null;
  }

  async listGifts(businessId: string, limit = 50) {
    const result = await this.hasuraSystemService.executeQuery(
      `query ListAiTokenGifts($businessId: uuid!, $limit: Int!) {
        sent: ai_token_transfers(
          where: { sender_business_id: { _eq: $businessId } }
          order_by: { created_at: desc }
          limit: $limit
        ) {
          id amount status created_at
          recipient_user { first_name last_name }
        }
        received: ai_token_transfers(
          where: { recipient_business_id: { _eq: $businessId } }
          order_by: { created_at: desc }
          limit: $limit
        ) {
          id amount status created_at
          sender_user { first_name last_name }
        }
      }`,
      { businessId, limit }
    );
    return {
      sent: (result.sent ?? []).map((row: any) => ({
        id: row.id,
        amount: row.amount,
        status: row.status,
        created_at: row.created_at,
        direction: 'sent' as const,
        maskedName: maskPersonName(
          row.recipient_user?.first_name,
          row.recipient_user?.last_name
        ),
      })),
      received: (result.received ?? []).map((row: any) => ({
        id: row.id,
        amount: row.amount,
        status: row.status,
        created_at: row.created_at,
        direction: 'received' as const,
        maskedName: maskPersonName(
          row.sender_user?.first_name,
          row.sender_user?.last_name
        ),
      })),
    };
  }

  private async executeTransfer(params: {
    senderBusinessId: string;
    senderUserId: string;
    recipientBusinessId: string;
    recipientUserId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<GiftTransferRow> {
    try {
      const result = await this.hasuraSystemService.executeMutation(
        `mutation TransferAiTokens(
          $senderBusinessId: uuid!
          $senderUserId: uuid!
          $recipientBusinessId: uuid!
          $recipientUserId: uuid!
          $amount: Int!
          $idempotencyKey: String!
        ) {
          transfer_ai_tokens(args: {
            p_sender_business_id: $senderBusinessId
            p_sender_user_id: $senderUserId
            p_recipient_business_id: $recipientBusinessId
            p_recipient_user_id: $recipientUserId
            p_amount: $amount
            p_idempotency_key: $idempotencyKey
          }) {
            id amount status created_at
            sender_business_id recipient_business_id recipient_user_id
          }
        }`,
        {
          senderBusinessId: params.senderBusinessId,
          senderUserId: params.senderUserId,
          recipientBusinessId: params.recipientBusinessId,
          recipientUserId: params.recipientUserId,
          amount: params.amount,
          idempotencyKey: params.idempotencyKey.trim(),
        }
      );
      const row = result?.transfer_ai_tokens?.[0];
      if (!row) {
        throw new HttpException(
          {
            success: false,
            error: 'Transfer failed. No tokens were deducted.',
            code: 'GIFT_FAILED',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      return row;
    } catch (error: any) {
      throw this.mapTransferError(error);
    }
  }

  private mapTransferError(error: any): HttpException {
    const message = String(error?.message || error || '');
    if (message.includes('ai_token_transfer_daily_limit')) {
      return new HttpException(
        {
          success: false,
          error: "You've reached today's gifting limit. Try again tomorrow.",
          code: 'GIFT_DAILY_LIMIT',
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    if (message.includes('ai_token_transfer_insufficient')) {
      return new BadRequestException({
        success: false,
        error: 'Not enough transferable tokens.',
        code: 'GIFT_INSUFFICIENT',
      });
    }
    if (message.includes('ai_token_transfer_self')) {
      return new BadRequestException({
        success: false,
        error: 'You cannot send tokens to yourself.',
        code: 'GIFT_SELF',
      });
    }
    if (message.includes('ai_token_transfer_invalid_amount')) {
      return new BadRequestException({
        success: false,
        error: 'Amount must be between 10 and 5000 tokens.',
        code: 'GIFT_INVALID_AMOUNT',
      });
    }
    this.logger.error(`AI token gift failed: ${message}`);
    return new HttpException(
      {
        success: false,
        error: 'Transfer failed. No tokens were deducted.',
        code: 'GIFT_FAILED',
      },
      HttpStatus.BAD_REQUEST
    );
  }

  private async resolveRecipientBusiness(
    code: string,
    senderUserId: string
  ): Promise<GiftLookupResult> {
    const normalized =
      this.businessReferralsService.normalizeReferralCode(code);
    if (!normalized) {
      throw new BadRequestException({
        success: false,
        error: 'Invalid referral code format',
        code: 'GIFT_INVALID_CODE',
      });
    }
    const fromUser = await this.resolveFromUserCode(normalized, senderUserId);
    if (fromUser) return fromUser;
    const fromAgent = await this.resolveFromAgentCode(normalized, senderUserId);
    if (fromAgent) return fromAgent;
    const fromBusiness = await this.resolveFromBusinessCode(
      normalized,
      senderUserId
    );
    if (fromBusiness) return fromBusiness;
    throw new HttpException(
      {
        success: false,
        error: 'No user found with this code.',
        code: 'GIFT_NOT_FOUND',
      },
      HttpStatus.NOT_FOUND
    );
  }

  private async resolveFromUserCode(
    code: string,
    senderUserId: string
  ): Promise<GiftLookupResult | null> {
    const user =
      await this.businessReferralsService.findUserByReferralCode(code);
    if (!user) return null;
    if (user.userId === senderUserId) {
      throw new BadRequestException({
        success: false,
        error: 'You cannot send tokens to yourself.',
        code: 'GIFT_SELF',
      });
    }
    return this.requireBusinessForUser(user.userId, code, {
      firstName: user.userFirstName,
      lastName: user.userLastName,
    });
  }

  private async resolveFromAgentCode(
    code: string,
    senderUserId: string
  ): Promise<GiftLookupResult | null> {
    const agent = await this.agentReferralsService.findAgentByCode(code);
    if (!agent || agent.status !== 'active') return null;
    if (agent.userId === senderUserId) {
      throw new BadRequestException({
        success: false,
        error: 'You cannot send tokens to yourself.',
        code: 'GIFT_SELF',
      });
    }
    return this.requireBusinessForUser(agent.userId, code, {
      firstName: agent.userFirstName,
      lastName: agent.userLastName,
    });
  }

  private async resolveFromBusinessCode(
    code: string,
    senderUserId: string
  ): Promise<GiftLookupResult | null> {
    const business =
      await this.businessReferralsService.findBusinessByCode(code);
    if (!business || business.lifecycleStatus === 'suspended') return null;
    if (business.userId === senderUserId) {
      throw new BadRequestException({
        success: false,
        error: 'You cannot send tokens to yourself.',
        code: 'GIFT_SELF',
      });
    }
    return {
      maskedName: maskPersonName(
        business.userFirstName,
        business.userLastName
      ),
      referralCode: code,
      recipientBusinessId: business.businessId,
      recipientUserId: business.userId,
    };
  }

  private async requireBusinessForUser(
    userId: string,
    code: string,
    names: { firstName: string; lastName: string }
  ): Promise<GiftLookupResult> {
    const result = await this.hasuraSystemService.executeQuery(
      `query BusinessForGiftRecipient($userId: uuid!) {
        businesses(where: { user_id: { _eq: $userId } }, limit: 1) {
          id lifecycle_status
        }
      }`,
      { userId }
    );
    const row = result?.businesses?.[0];
    if (!row || row.lifecycle_status === 'suspended') {
      throw new BadRequestException({
        success: false,
        error: "This user can't receive tokens yet.",
        code: 'GIFT_INELIGIBLE',
      });
    }
    return {
      maskedName: maskPersonName(names.firstName, names.lastName),
      referralCode: code,
      recipientBusinessId: row.id,
      recipientUserId: userId,
    };
  }

  private async loadTokenRow(businessId: string): Promise<{
    ai_tokens: number;
    ai_tokens_nongiftable: number;
  }> {
    const result = await this.hasuraSystemService.executeQuery(
      `query GiftTokenBalance($id: uuid!) {
        businesses_by_pk(id: $id) { ai_tokens ai_tokens_nongiftable }
      }`,
      { id: businessId }
    );
    return {
      ai_tokens: result.businesses_by_pk?.ai_tokens ?? 0,
      ai_tokens_nongiftable:
        result.businesses_by_pk?.ai_tokens_nongiftable ?? SIGNUP_AI_TOKENS,
    };
  }

  private async maskedNameForUser(userId: string): Promise<string> {
    const result = await this.hasuraSystemService.executeQuery(
      `query GiftSenderName($id: uuid!) {
        users_by_pk(id: $id) { first_name last_name preferred_language }
      }`,
      { id: userId }
    );
    return maskPersonName(
      result.users_by_pk?.first_name,
      result.users_by_pk?.last_name
    );
  }

  private async notifyRecipient(params: {
    recipientUserId: string;
    senderMaskedName: string;
    amount: number;
    transferId: string;
  }): Promise<void> {
    try {
      const lang = await this.recipientLanguage(params.recipientUserId);
      const isFr = lang === 'fr';
      const title = isFr
        ? 'Vous avez reçu des jetons IA'
        : 'You received AI tokens';
      const body = isFr
        ? `${params.senderMaskedName} vous a offert ${params.amount} jetons IA pour vous aider à préparer votre boutique.`
        : `${params.senderMaskedName} gifted you ${params.amount} AI tokens to help set up your store.`;
      await this.notificationsService.sendPaymentProgramNotice({
        userId: params.recipientUserId,
        title,
        body,
        messageType: 'AI_TOKEN_GIFT',
        entityId: params.transferId,
        path: '/business/ai-tokens',
        event: 'business_ai_tokens',
      });
    } catch (error: any) {
      this.logger.warn(
        `Gift notification failed for ${params.recipientUserId}: ${error?.message}`
      );
    }
  }

  private async recipientLanguage(userId: string): Promise<string> {
    const result = await this.hasuraSystemService.executeQuery(
      `query GiftRecipientLang($id: uuid!) {
        users_by_pk(id: $id) { preferred_language }
      }`,
      { id: userId }
    );
    return (result.users_by_pk?.preferred_language || 'en').toLowerCase();
  }
}
