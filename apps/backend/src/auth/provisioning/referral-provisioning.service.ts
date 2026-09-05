import { Injectable, Logger } from '@nestjs/common';
import { AgentReferralsService } from '../../agents/agent-referrals.service';
import {
  BusinessReferralsService,
  ResolvedBusinessReferral,
} from '../../business-referrals/business-referrals.service';
import { CreditsService } from '../../credits/credits.service';
import type { PersonaId } from '../../users/persona.types';
import type { ProvisionedEntity } from './user-provisioning.service';

@Injectable()
export class ReferralProvisioningService {
  private readonly logger = new Logger(ReferralProvisioningService.name);

  constructor(
    private readonly businessReferralsService: BusinessReferralsService,
    private readonly agentReferralsService: AgentReferralsService,
    private readonly creditsService: CreditsService
  ) {}

  /** Fail-fast pre-insert resolution when agent or business persona + code present. */
  async resolveSignupReferral(
    personas: PersonaId[],
    referralAgentCode?: string
  ): Promise<ResolvedBusinessReferral | null> {
    if (!personas.includes('business') && !personas.includes('agent')) {
      return null;
    }
    return this.businessReferralsService.resolveBusinessReferralCode(
      referralAgentCode
    );
  }

  /** @deprecated use resolveSignupReferral */
  async resolveBusinessReferral(
    personas: PersonaId[],
    referralAgentCode?: string
  ): Promise<ResolvedBusinessReferral | null> {
    return this.resolveSignupReferral(personas, referralAgentCode);
  }

  getBusinessInsertReferralFields(
    referral: ResolvedBusinessReferral | null
  ): {
    business_referral_agent_id?: string;
    business_referral_business_id?: string;
    business_referral_code_used?: string;
  } {
    return this.businessReferralsService.getBusinessInsertReferralFields(
      referral
    );
  }

  getAgentInsertReferralFields(referral: ResolvedBusinessReferral | null): {
    agent_referral_agent_id?: string;
    agent_referral_business_id?: string;
    agent_referral_code_used?: string;
  } {
    return this.agentReferralsService.getAgentInsertReferralFields(referral);
  }

  async runPostCommitEffects(input: {
    entities: ProvisionedEntity[];
    referral: ResolvedBusinessReferral | null;
    referralAgentCode?: string;
    country?: string;
    businessName: string;
    ownerName: string;
  }): Promise<void> {
    const business = input.entities.find((e) => e.type === 'business');
    if (business && input.referral) {
      await this.notifyBusinessReferral(business.id, input);
      await this.awardReferralCredit(input.referral, {
        kind: 'business',
        id: business.id,
      });
    }

    const agent = input.entities.find((e) => e.type === 'agent');
    if (agent && input.referral) {
      await this.awardReferralCredit(input.referral, {
        kind: 'agent',
        id: agent.id,
      });
    }
  }

  private async notifyBusinessReferral(
    businessId: string,
    input: {
      referral: ResolvedBusinessReferral | null;
      country?: string;
      businessName: string;
      ownerName: string;
    }
  ): Promise<void> {
    if (!input.referral) return;
    try {
      await this.businessReferralsService.notifyReferrerOfBusinessReferral(
        {
          businessId,
          countryCode: input.country,
          businessName: input.businessName,
          businessOwnerName: input.ownerName,
        },
        input.referral
      );
    } catch (error: any) {
      this.logger.warn(`Business referral notify failed: ${error?.message}`);
    }
  }

  private async awardReferralCredit(
    referral: ResolvedBusinessReferral,
    target: { kind: 'business' | 'agent'; id: string }
  ): Promise<void> {
    try {
      const referrerUserId = await this.creditsService.resolveReferrerUserId({
        kind: referral.kind,
        agentId: referral.kind === 'agent' ? referral.agentId : undefined,
        businessUserId:
          referral.kind === 'business' ? referral.userId : undefined,
      });
      if (!referrerUserId) return;
      if (target.kind === 'business') {
        await this.creditsService.awardBusinessReferred({
          referrerUserId,
          businessId: target.id,
        });
        return;
      }
      await this.creditsService.awardAgentReferred({
        referrerUserId,
        agentId: target.id,
      });
    } catch (error: any) {
      this.logger.warn(`Referral credit award failed: ${error?.message}`);
    }
  }
}
