import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AgentReferralsService } from '../agents/agent-referrals.service';
import {
  BusinessReferralsService,
  type ResolvedBusinessReferral,
} from '../business-referrals/business-referrals.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { hasExistingReferrer } from './admin-referral.util';

type ReferralTarget = {
  id: string;
  user_id: string;
  name: string;
  ownerName: string;
  referred_by_agent_id?: string | null;
  referred_by_business_id?: string | null;
};

@Injectable()
export class AdminReferralService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly businessReferralsService: BusinessReferralsService,
    private readonly agentReferralsService: AgentReferralsService,
    private readonly paymentRoutingService: PaymentRoutingService
  ) {}

  async applyToAgent(agentId: string, code: string): Promise<{ success: true }> {
    const agent = await this.loadAgent(agentId);
    this.assertNoReferrer(agent);
    const resolved = await this.resolveForUser(code, agent.user_id);
    await this.persistThenCreditAgent(agent, resolved);
    return { success: true };
  }

  async applyToBusiness(
    businessId: string,
    code: string
  ): Promise<{ success: true }> {
    const business = await this.loadBusiness(businessId);
    this.assertNoReferrer(business);
    const resolved = await this.resolveForUser(code, business.user_id);
    await this.updateBusinessReferral(business.id, resolved);
    await this.notifyBusinessReferrer(business, resolved);
    return { success: true };
  }

  private assertNoReferrer(row: ReferralTarget): void {
    if (!hasExistingReferrer(row)) return;
    throw new HttpException(
      { success: false, error: 'Referral already applied' },
      HttpStatus.CONFLICT
    );
  }

  private async resolveForUser(
    code: string,
    userId: string
  ): Promise<ResolvedBusinessReferral> {
    const resolved = await this.businessReferralsService.resolveBusinessReferralCode(
      code,
      userId
    );
    if (resolved) return resolved;
    throw new HttpException(
      { success: false, error: 'Referral code is required' },
      HttpStatus.BAD_REQUEST
    );
  }

  private async loadAgent(agentId: string): Promise<ReferralTarget> {
    const q = `
      query AdminLoadAgent($id: uuid!) {
        agents_by_pk(id: $id) {
          id user_id referred_by_agent_id referred_by_business_id
          user { first_name last_name }
        }
      }
    `;
    const r = await this.hasuraSystemService.executeQuery(q, { id: agentId });
    const row = r?.agents_by_pk;
    if (!row) this.throwNotFound('Agent not found');
    const name = `${row.user?.first_name ?? ''} ${row.user?.last_name ?? ''}`.trim();
    return { ...row, name: name || 'Agent', ownerName: name || 'Agent' };
  }

  private async loadBusiness(businessId: string): Promise<ReferralTarget> {
    const q = `
      query AdminLoadBusiness($id: uuid!) {
        businesses_by_pk(id: $id) {
          id user_id name referred_by_agent_id referred_by_business_id
          user { first_name last_name }
        }
      }
    `;
    const r = await this.hasuraSystemService.executeQuery(q, { id: businessId });
    const row = r?.businesses_by_pk;
    if (!row) this.throwNotFound('Business not found');
    const ownerName = `${row.user?.first_name ?? ''} ${row.user?.last_name ?? ''}`.trim();
    return {
      ...row,
      name: row.name?.trim() || 'Business',
      ownerName: ownerName || row.name?.trim() || 'Business',
    };
  }

  private async updateAgentReferral(
    agentId: string,
    resolved: ResolvedBusinessReferral
  ): Promise<void> {
    const q = `
      mutation AdminApplyAgentReferral(
        $id: uuid!, $agentId: uuid, $businessId: uuid, $code: String!
      ) {
        update_agents_by_pk(
          pk_columns: { id: $id }
          _set: {
            referred_by_agent_id: $agentId
            referred_by_business_id: $businessId
            referral_code_used: $code
          }
        ) { id }
      }
    `;
    await this.hasuraSystemService.executeQuery(q, this.updateVars(agentId, resolved));
  }

  private async updateBusinessReferral(
    businessId: string,
    resolved: ResolvedBusinessReferral
  ): Promise<void> {
    const q = `
      mutation AdminApplyBusinessReferral(
        $id: uuid!, $agentId: uuid, $businessId: uuid, $code: String!
      ) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _set: {
            referred_by_agent_id: $agentId
            referred_by_business_id: $businessId
            referral_code_used: $code
          }
        ) { id }
      }
    `;
    await this.hasuraSystemService.executeQuery(q, this.updateVars(businessId, resolved));
  }

  private updateVars(id: string, resolved: ResolvedBusinessReferral) {
    return {
      id,
      agentId: resolved.kind === 'agent' ? resolved.agentId : null,
      businessId: resolved.kind === 'business' ? resolved.businessId : null,
      code: resolved.normalizedCode,
    };
  }

  private async persistThenCreditAgent(
    agent: ReferralTarget,
    resolved: ResolvedBusinessReferral
  ): Promise<void> {
    const country = await this.requireCountry(agent.user_id);
    await this.updateAgentReferral(agent.id, resolved);
    try {
      await this.agentReferralsService.creditResolvedAgentReferral(
        agent.id,
        resolved,
        country,
        agent.name,
        { swallowErrors: false }
      );
    } catch (error: any) {
      await this.agentReferralsService.deleteReferralForReferredAgent(agent.id);
      await this.clearAgentReferral(agent.id);
      throw error;
    }
  }

  private async requireCountry(userId: string): Promise<string> {
    const country = await this.paymentRoutingService.getUserCountryCode(userId);
    if (country) return country;
    throw new HttpException(
      {
        success: false,
        error: 'Cannot apply agent referral without a country on the account',
      },
      HttpStatus.BAD_REQUEST
    );
  }

  private async clearAgentReferral(agentId: string): Promise<void> {
    const q = `
      mutation AdminClearAgentReferral($id: uuid!) {
        update_agents_by_pk(
          pk_columns: { id: $id }
          _set: {
            referred_by_agent_id: null
            referred_by_business_id: null
            referral_code_used: null
          }
        ) { id }
      }
    `;
    await this.hasuraSystemService.executeQuery(q, { id: agentId });
  }

  private async notifyBusinessReferrer(
    business: ReferralTarget,
    resolved: ResolvedBusinessReferral
  ): Promise<void> {
    const country = await this.paymentRoutingService.getUserCountryCode(
      business.user_id
    );
    await this.businessReferralsService.notifyReferrerOfBusinessReferral(
      {
        businessId: business.id,
        countryCode: country ?? undefined,
        businessName: business.name,
        businessOwnerName: business.ownerName,
      },
      resolved
    );
  }

  private throwNotFound(message: string): never {
    throw new HttpException(
      { success: false, error: message },
      HttpStatus.NOT_FOUND
    );
  }
}
