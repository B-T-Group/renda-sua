import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { maskPersonName } from '../common/utils/mask-name.util';
import { hasExistingReferrer } from '../admin/admin-referral.util';
import {
  BusinessReferralsService,
  type ResolvedBusinessReferral,
} from '../business-referrals/business-referrals.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';

const LATE_REFERRAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type LateReferralStatus = {
  canEnter: boolean;
  locked: boolean;
  expired: boolean;
  maskedReferrerName: string | null;
  accountCreatedAt: string;
  windowEndsAt: string;
};

@Injectable()
export class LateReferralService {
  private readonly logger = new Logger(LateReferralService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly businessReferralsService: BusinessReferralsService,
    private readonly notificationsService: NotificationsService
  ) {}

  async getStatus(userId: string): Promise<LateReferralStatus> {
    const user = await this.loadUser(userId);
    const windowEndsAt = new Date(
      new Date(user.created_at).getTime() + LATE_REFERRAL_WINDOW_MS
    ).toISOString();
    const expired =
      Date.now() > new Date(user.created_at).getTime() + LATE_REFERRAL_WINDOW_MS;
    const personas = await this.loadPersonas(userId);
    if (!personas.agent && !personas.business) {
      return {
        canEnter: false,
        locked: false,
        expired,
        maskedReferrerName: null,
        accountCreatedAt: user.created_at,
        windowEndsAt,
      };
    }
    const hasReferrer =
      (personas.agent && hasExistingReferrer(personas.agent)) ||
      (personas.business && hasExistingReferrer(personas.business));
    if (hasReferrer) {
      const name = await this.maskedReferrerFromPersonas(personas);
      return {
        canEnter: false,
        locked: true,
        expired: false,
        maskedReferrerName: name,
        accountCreatedAt: user.created_at,
        windowEndsAt,
      };
    }
    return {
      canEnter: !expired,
      locked: false,
      expired,
      maskedReferrerName: null,
      accountCreatedAt: user.created_at,
      windowEndsAt,
    };
  }

  async lookup(userId: string, code: string): Promise<{ maskedName: string }> {
    await this.assertCanEnter(userId);
    const resolved = await this.resolveCode(code, userId);
    return {
      maskedName: maskPersonName(
        resolved.userFirstName,
        await this.lastNameForResolved(resolved)
      ),
    };
  }

  async apply(
    userId: string,
    code: string
  ): Promise<{ maskedName: string }> {
    await this.assertCanEnter(userId);
    const resolved = await this.resolveCode(code, userId);
    await this.assertNotCircular(userId, resolved);
    const personas = await this.loadPersonas(userId);
    const appliedAt = new Date().toISOString();
    let applied = false;
    if (personas.agent && !hasExistingReferrer(personas.agent)) {
      applied =
        (await this.applyToAgent(personas.agent.id, resolved, appliedAt)) ||
        applied;
    }
    if (personas.business && !hasExistingReferrer(personas.business)) {
      applied =
        (await this.applyToBusiness(
          personas.business.id,
          resolved,
          appliedAt
        )) || applied;
    }
    if (!applied) {
      throw new HttpException(
        { success: false, error: 'Referral already applied', code: 'ALREADY_SET' },
        HttpStatus.CONFLICT
      );
    }
    const maskedName = maskPersonName(
      resolved.userFirstName,
      await this.lastNameForResolved(resolved)
    );
    await this.notifyReferrer(userId, resolved);
    return { maskedName };
  }

  private async assertCanEnter(userId: string): Promise<void> {
    const status = await this.getStatus(userId);
    if (status.locked) {
      throw new HttpException(
        { success: false, error: 'Referral already applied', code: 'ALREADY_SET' },
        HttpStatus.CONFLICT
      );
    }
    if (status.expired || !status.canEnter) {
      throw new BadRequestException({
        success: false,
        error:
          'Referral codes can only be added within 30 days of signup.',
        code: 'EXPIRED',
      });
    }
  }

  private async resolveCode(
    code: string,
    userId: string
  ): Promise<ResolvedBusinessReferral> {
    const resolved =
      await this.businessReferralsService.resolveBusinessReferralCode(
        code,
        userId
      );
    if (!resolved || resolved.kind === 'user') {
      throw new HttpException(
        {
          success: false,
          error: 'No user found with this code.',
          code: 'NOT_FOUND',
        },
        HttpStatus.NOT_FOUND
      );
    }
    return resolved;
  }

  private async assertNotCircular(
    userId: string,
    resolved: ResolvedBusinessReferral
  ): Promise<void> {
    const referrerUserId = resolved.userId;
    const result = await this.hasuraSystemService.executeQuery(
      `query LateReferralCircular($referrerUserId: uuid!, $userId: uuid!) {
        agents(
          where: {
            user_id: { _eq: $referrerUserId }
            _or: [
              { referring_agent: { user_id: { _eq: $userId } } }
              { referring_business: { user_id: { _eq: $userId } } }
            ]
          }
          limit: 1
        ) { id }
        businesses(
          where: {
            user_id: { _eq: $referrerUserId }
            _or: [
              { referring_agent: { user_id: { _eq: $userId } } }
              { referring_business: { user_id: { _eq: $userId } } }
            ]
          }
          limit: 1
        ) { id }
      }`,
      { referrerUserId, userId }
    );
    if (result?.agents?.[0] || result?.businesses?.[0]) {
      throw new BadRequestException({
        success: false,
        error:
          'You referred this person, so they cannot be your referrer.',
        code: 'CIRCULAR',
      });
    }
  }

  private async applyToAgent(
    agentId: string,
    resolved: ResolvedBusinessReferral,
    appliedAt: string
  ): Promise<boolean> {
    const result = await this.hasuraSystemService.executeMutation(
      `mutation LateApplyAgentReferral(
        $id: uuid!, $agentId: uuid, $businessId: uuid, $code: String!, $appliedAt: timestamptz!
      ) {
        update_agents(
          where: {
            id: { _eq: $id }
            referred_by_agent_id: { _is_null: true }
            referred_by_business_id: { _is_null: true }
          }
          _set: {
            referred_by_agent_id: $agentId
            referred_by_business_id: $businessId
            referral_code_used: $code
            referral_applied_at: $appliedAt
          }
        ) { affected_rows }
      }`,
      {
        id: agentId,
        agentId: resolved.kind === 'agent' ? resolved.agentId : null,
        businessId: resolved.kind === 'business' ? resolved.businessId : null,
        code: resolved.normalizedCode,
        appliedAt,
      }
    );
    return (result?.update_agents?.affected_rows ?? 0) > 0;
  }

  private async applyToBusiness(
    businessId: string,
    resolved: ResolvedBusinessReferral,
    appliedAt: string
  ): Promise<boolean> {
    const result = await this.hasuraSystemService.executeMutation(
      `mutation LateApplyBusinessReferral(
        $id: uuid!, $agentId: uuid, $businessId: uuid, $code: String!, $appliedAt: timestamptz!
      ) {
        update_businesses(
          where: {
            id: { _eq: $id }
            referred_by_agent_id: { _is_null: true }
            referred_by_business_id: { _is_null: true }
          }
          _set: {
            referred_by_agent_id: $agentId
            referred_by_business_id: $businessId
            referral_code_used: $code
            referral_applied_at: $appliedAt
          }
        ) { affected_rows }
      }`,
      {
        id: businessId,
        agentId: resolved.kind === 'agent' ? resolved.agentId : null,
        businessId: resolved.kind === 'business' ? resolved.businessId : null,
        code: resolved.normalizedCode,
        appliedAt,
      }
    );
    return (result?.update_businesses?.affected_rows ?? 0) > 0;
  }

  private async loadUser(userId: string): Promise<{ created_at: string }> {
    const result = await this.hasuraSystemService.executeQuery(
      `query LateReferralUser($id: uuid!) {
        users_by_pk(id: $id) { created_at }
      }`,
      { id: userId }
    );
    if (!result?.users_by_pk?.created_at) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return result.users_by_pk;
  }

  private async loadPersonas(userId: string): Promise<{
    agent: {
      id: string;
      referred_by_agent_id?: string | null;
      referred_by_business_id?: string | null;
      referral_code_used?: string | null;
    } | null;
    business: {
      id: string;
      referred_by_agent_id?: string | null;
      referred_by_business_id?: string | null;
      referral_code_used?: string | null;
    } | null;
  }> {
    const result = await this.hasuraSystemService.executeQuery(
      `query LateReferralPersonas($userId: uuid!) {
        agents(where: { user_id: { _eq: $userId } }, limit: 1) {
          id referred_by_agent_id referred_by_business_id referral_code_used
        }
        businesses(where: { user_id: { _eq: $userId } }, limit: 1) {
          id referred_by_agent_id referred_by_business_id referral_code_used
        }
      }`,
      { userId }
    );
    return {
      agent: result?.agents?.[0] ?? null,
      business: result?.businesses?.[0] ?? null,
    };
  }

  private async maskedReferrerFromPersonas(personas: {
    agent: {
      referred_by_agent_id?: string | null;
      referred_by_business_id?: string | null;
    } | null;
    business: {
      referred_by_agent_id?: string | null;
      referred_by_business_id?: string | null;
    } | null;
  }): Promise<string | null> {
    const agentId =
      personas.agent?.referred_by_agent_id ||
      personas.business?.referred_by_agent_id;
    const businessId =
      personas.agent?.referred_by_business_id ||
      personas.business?.referred_by_business_id;
    if (agentId) {
      const r = await this.hasuraSystemService.executeQuery(
        `query LateReferrerAgent($id: uuid!) {
          agents_by_pk(id: $id) { user { first_name last_name } }
        }`,
        { id: agentId }
      );
      const u = r?.agents_by_pk?.user;
      return u ? maskPersonName(u.first_name, u.last_name) : 'Referrer unavailable';
    }
    if (businessId) {
      const r = await this.hasuraSystemService.executeQuery(
        `query LateReferrerBusiness($id: uuid!) {
          businesses_by_pk(id: $id) { user { first_name last_name } }
        }`,
        { id: businessId }
      );
      const u = r?.businesses_by_pk?.user;
      return u ? maskPersonName(u.first_name, u.last_name) : 'Referrer unavailable';
    }
    return null;
  }

  private async lastNameForResolved(
    resolved: ResolvedBusinessReferral
  ): Promise<string> {
    const result = await this.hasuraSystemService.executeQuery(
      `query LateReferralLastName($id: uuid!) {
        users_by_pk(id: $id) { last_name }
      }`,
      { id: resolved.userId }
    );
    return result?.users_by_pk?.last_name ?? '';
  }

  private async notifyReferrer(
    referredUserId: string,
    resolved: ResolvedBusinessReferral
  ): Promise<void> {
    try {
      const referred = await this.hasuraSystemService.executeQuery(
        `query LateReferredName($id: uuid!) {
          users_by_pk(id: $id) { first_name last_name preferred_language }
        }`,
        { id: referredUserId }
      );
      const name = maskPersonName(
        referred?.users_by_pk?.first_name,
        referred?.users_by_pk?.last_name
      );
      const lang = (
        resolved.preferredLanguage ||
        referred?.users_by_pk?.preferred_language ||
        'en'
      ).toLowerCase();
      const isFr = lang === 'fr';
      const title = isFr ? 'Nouveau filleul' : 'New referral';
      const body = isFr
        ? `${name} a rejoint avec votre code`
        : `${name} joined with your code`;
      await this.notificationsService.sendPaymentProgramNotice({
        userId: resolved.userId,
        title,
        body,
        messageType: 'LATE_REFERRAL_APPLIED',
        entityId: referredUserId,
        path: '/profile',
        event: 'referral_joined',
      });
    } catch (error: any) {
      this.logger.warn(`Late referral notify failed: ${error?.message}`);
    }
  }
}
