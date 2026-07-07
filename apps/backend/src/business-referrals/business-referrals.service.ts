import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentReferralsService } from '../agents/agent-referrals.service';
import { Configuration } from '../config/configuration';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';

export interface BusinessReferralParams {
  businessId: string;
  countryCode?: string;
  businessName: string;
  businessOwnerName: string;
}

export interface ResolvedBusinessReferral {
  agentId: string;
  normalizedCode: string;
  userEmail: string;
  userFirstName: string;
  preferredLanguage: string;
}

@Injectable()
export class BusinessReferralsService {
  private readonly logger = new Logger(BusinessReferralsService.name);

  constructor(
    private readonly agentReferralsService: AgentReferralsService,
    private readonly notificationsService: NotificationsService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  async resolveBusinessReferralCode(
    referralAgentCode?: string,
    excludeUserId?: string
  ): Promise<ResolvedBusinessReferral | null> {
    const rawCode = referralAgentCode?.trim();
    if (!rawCode) {
      return null;
    }

    const { agent, normalizedCode } =
      await this.resolveActiveReferringAgent(rawCode, excludeUserId);

    return {
      agentId: agent.agentId,
      normalizedCode,
      userEmail: agent.userEmail,
      userFirstName: agent.userFirstName,
      preferredLanguage: agent.preferredLanguage,
    };
  }

  getBusinessInsertReferralFields(resolved: ResolvedBusinessReferral | null): {
    business_referral_agent_id?: string;
    business_referral_code_used?: string;
  } {
    if (!resolved) {
      return {};
    }
    return {
      business_referral_agent_id: resolved.agentId,
      business_referral_code_used: resolved.normalizedCode,
    };
  }

  async notifyAgentOfBusinessReferral(
    params: BusinessReferralParams,
    resolved: ResolvedBusinessReferral
  ): Promise<void> {
    const rail = await this.paymentRoutingService.resolveRailForCountry(
      params.countryCode
    );
    const dashboardUrl = `${this.getPublicWebAppUrl()}/agent/dashboard`;

    try {
      await this.notificationsService.sendAgentBusinessReferredEmail({
        to: resolved.userEmail,
        preferredLanguage: resolved.preferredLanguage,
        recipientName: resolved.userFirstName,
        businessName: params.businessName,
        businessOwnerName: params.businessOwnerName,
        paymentRail: rail,
        dashboardUrl,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to send agent business referred email for business ${params.businessId}: ${error.message}`
      );
    }
  }

  private throwReferralError(message: string): never {
    throw new HttpException({ success: false, error: message }, HttpStatus.BAD_REQUEST);
  }

  private async resolveActiveReferringAgent(
    rawCode: string,
    excludeUserId?: string
  ) {
    const normalizedCode =
      this.agentReferralsService.normalizeAgentCode(rawCode);
    if (!normalizedCode) {
      this.throwReferralError('Invalid agent referral code format');
    }

    const referringAgent =
      await this.agentReferralsService.findAgentByCode(normalizedCode);
    if (!referringAgent) {
      this.throwReferralError('No agent found for this referral code');
    }
    if (referringAgent.status !== 'active') {
      this.throwReferralError('This referral code is not currently active');
    }
    if (excludeUserId && referringAgent.userId === excludeUserId) {
      this.throwReferralError('You cannot use your own referral code');
    }

    return { agent: referringAgent, normalizedCode };
  }

  private getPublicWebAppUrl(): string {
    return (
      this.configService.get<string>('publicWebAppUrl') ||
      'https://rendasua.com'
    ).replace(/\/$/, '');
  }
}
