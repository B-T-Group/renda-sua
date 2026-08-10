import { Injectable, Logger } from '@nestjs/common';
import { AgentReferralsService } from '../../agents/agent-referrals.service';
import {
  BusinessReferralsService,
  ResolvedBusinessReferral,
} from '../../business-referrals/business-referrals.service';
import type { PersonaId } from '../../users/persona.types';
import type { ProvisionedEntity } from './user-provisioning.service';

@Injectable()
export class ReferralProvisioningService {
  private readonly logger = new Logger(ReferralProvisioningService.name);

  constructor(
    private readonly businessReferralsService: BusinessReferralsService,
    private readonly agentReferralsService: AgentReferralsService
  ) {}

  /** Fail-fast pre-insert resolution when business persona + code present. */
  async resolveBusinessReferral(
    personas: PersonaId[],
    referralAgentCode?: string
  ): Promise<ResolvedBusinessReferral | null> {
    if (!personas.includes('business')) return null;
    return this.businessReferralsService.resolveBusinessReferralCode(
      referralAgentCode
    );
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
      try {
        await this.businessReferralsService.notifyReferrerOfBusinessReferral(
          {
            businessId: business.id,
            countryCode: input.country,
            businessName: input.businessName,
            businessOwnerName: input.ownerName,
          },
          input.referral
        );
      } catch (error: any) {
        this.logger.warn(
          `Business referral notify failed: ${error?.message}`
        );
      }
    }

    const agent = input.entities.find((e) => e.type === 'agent');
    if (agent) {
      try {
        await this.agentReferralsService.creditAgentReferralIfPresent(
          agent.id,
          input.referralAgentCode,
          input.country
        );
      } catch (error: any) {
        this.logger.warn(`Agent referral credit failed: ${error?.message}`);
      }
    }
  }
}
