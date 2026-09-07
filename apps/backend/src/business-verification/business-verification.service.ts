import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import * as fs from 'fs';
import Mustache from 'mustache';
import * as path from 'path';
import {
  MERCHANT_AGREEMENT_TEMPLATE,
  MERCHANT_AGREEMENT_VERSION,
} from '../agreements/merchant-agreement.constants';
import { BusinessContractsService } from '../business-contracts/business-contracts.service';
import { MerchantAgreementProviderService } from '../business-contracts/merchant-agreement-provider.service';
import { getCommissionMapForCountry } from '../commissions/business-account-type';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../pdf/pdf.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { StripeConnectService } from '../stripe-payments/stripe-connect.service';
import { LaunchPromoService } from '../launch-promo/launch-promo.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { MobilePaymentPhonesService } from '../mobile-payment-phones/mobile-payment-phones.service';
import { AcceptMerchantAgreementDto } from './dto/accept-merchant-agreement.dto';
import { parseIdRejectionReason } from '../services/upload.service';

export type VerificationNextAction =
  | 'sign_agreement'
  | 'upload_id'
  | 'setup_stripe_connect'
  | 'publish_catalog'
  | 'pending_review'
  | 'verify_mobile_payment_phone'
  | 'complete';

const MERCHANT_ACTION_NEXT_ACTIONS: ReadonlySet<VerificationNextAction> =
  new Set(['sign_agreement', 'setup_stripe_connect']);

const ID_DOC_NAMES = ['id_card', 'passport', 'driver_license'];

@Injectable()
export class BusinessVerificationService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly pdfService: PdfService,
    private readonly notificationsService: NotificationsService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly merchantLifecycleService: MerchantLifecycleService,
    private readonly businessContractsService: BusinessContractsService,
    private readonly mobilePaymentPhonesService: MobilePaymentPhonesService,
    private readonly agreementProvider: MerchantAgreementProviderService,
    private readonly launchPromoService: LaunchPromoService
  ) {}

  async getStatus() {
    const user = await this.requireBusinessUser();
    const businessId = user.business!.id;
    // Keep lifecycle in sync when dashboard/status is opened (e.g. after
    // item approval paths that missed an explicit recompute).
    await this.merchantLifecycleService.recompute(
      businessId,
      'verification_status'
    );
    const base = await this.buildStatus(businessId, user);
    const lifecycle = await this.merchantLifecycleService.getBusinessSnapshot(
      businessId
    );
    const suspension =
      lifecycle?.lifecycle_status === 'suspended'
        ? await this.merchantLifecycleService.getLatestSuspension(businessId)
        : null;
    const lifecycleStatus = lifecycle?.lifecycle_status ?? 'created';
    const canAcceptOrders = lifecycle?.can_accept_orders ?? false;
    const storefrontVisible = lifecycle?.is_storefront_visible ?? false;
    const isVerified = lifecycle?.is_verified ?? false;
    const launchPromo = await this.launchPromoService.getSlotForBusiness(
      businessId
    );
    return {
      ...base,
      is_verified: isVerified,
      lifecycle_status: lifecycleStatus,
      is_storefront_visible: storefrontVisible,
      can_accept_orders: canAcceptOrders,
      isOnboarding: this.resolveIsOnboarding(lifecycleStatus, base),
      suspension,
      contract: await this.businessContractsService.getContractStatus(businessId),
      launchPromo: launchPromo
        ? {
            status: launchPromo.status,
            ordersRemaining: launchPromo.ordersRemaining,
            businessLimit: launchPromo.businessLimit,
            zeroCommissionOrders: launchPromo.zeroCommissionOrders,
            identificationWindowDays: launchPromo.identificationWindowDays,
            claimedAt: launchPromo.claimedAt,
            confirmedAt: launchPromo.confirmedAt,
          }
        : null,
    };
  }

  async getMerchantAgreementForUser() {
    const user = await this.requireBusinessUser();
    const lang = user.preferred_language?.startsWith('fr') ? 'fr' : 'en';
    const countryCode = await this.agreementProvider.getBusinessCountryCode(
      user.business!.id
    );
    const commissionMap = getCommissionMapForCountry(countryCode);
    const html = this.renderAgreementTemplate(lang, {
      businessName: user.business?.name ?? '',
      signerLegalName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      signerEmail: user.email ?? '',
      acceptedAt:
        lang === 'fr' ? 'À la signature électronique' : 'Upon electronic acceptance',
      agreementVersion: MERCHANT_AGREEMENT_VERSION,
      standardCommission: commissionMap.STANDARD,
      premiumCommission: commissionMap.PREMIUM,
      eliteCommission: commissionMap.ELITE,
    });
    return {
      version: MERCHANT_AGREEMENT_VERSION,
      locale: lang,
      html,
    };
  }

  async acceptAgreement(
    dto: AcceptMerchantAgreementDto,
    ipAddress: string | undefined,
    userAgent: string | undefined
  ) {
    const user = await this.requireBusinessUser();
    const business = user.business!;
    const boldSignForBusiness =
      await this.businessContractsService.isBoldSignEnabledForBusiness(
        business.id
      );
    if (boldSignForBusiness) {
      throw new BadRequestException(
        'Agreement must be signed via email. Check your inbox for the BoldSign request.'
      );
    }
    if (dto.agreementVersion !== MERCHANT_AGREEMENT_VERSION) {
      throw new BadRequestException('Agreement version is outdated. Please refresh and try again.');
    }
    const biz = business as { merchant_agreement_version?: string | null };
    if (biz.merchant_agreement_version === MERCHANT_AGREEMENT_VERSION) {
      throw new BadRequestException('This agreement version is already accepted.');
    }
    const countryCode = await this.agreementProvider.getBusinessCountryCode(
      business.id
    );
    const legalName = dto.legalName.trim();
    const acceptedAt = new Date().toISOString();
    const pdfUpload = await this.pdfService.generateMerchantAgreementPdf({
      locale: user.preferred_language ?? 'en',
      businessName: business.name,
      signerLegalName: legalName,
      signerEmail: user.email ?? '',
      agreementVersion: MERCHANT_AGREEMENT_VERSION,
      acceptedAt,
      signatureBase64: dto.signatureBase64,
      countryCode,
    });
    const acceptance = await this.insertAcceptance({
      businessId: business.id,
      dto,
      legalName,
      user,
      ipAddress,
      userAgent,
      pdfUploadId: pdfUpload.id,
      acceptedAt,
      countryCode,
    });
    await this.notificationsService.sendMerchantAgreementCopyEmail({
      to: user.email ?? '',
      businessName: business.name,
      signerLegalName: legalName,
      agreementVersion: MERCHANT_AGREEMENT_VERSION,
    });
    await this.merchantLifecycleService.recompute(
      business.id,
      'merchant_agreement_accepted'
    );
    return { acceptance, pdfUploadId: pdfUpload.id };
  }

  private async requireBusinessUser() {
    const user = await this.hasuraUserService.getUser();
    if (!user?.business?.id) {
      throw new ForbiddenException('User has no business');
    }
    return user;
  }

  private loadAgreementTemplate(lang: 'en' | 'fr'): string {
    const file = path.join(
      __dirname,
      '..',
      'agreements',
      `${MERCHANT_AGREEMENT_TEMPLATE}.${lang}.html`
    );
    return fs.readFileSync(file, 'utf8');
  }

  private renderAgreementTemplate(
    lang: 'en' | 'fr',
    data: {
      businessName: string;
      signerLegalName: string;
      signerEmail: string;
      acceptedAt: string;
      agreementVersion: string;
      signatureImageUrl?: string;
      standardCommission: number;
      premiumCommission: number;
      eliteCommission: number;
    }
  ): string {
    const template = this.loadAgreementTemplate(lang);
    return Mustache.render(template, data);
  }

  private async buildStatus(businessId: string, user: any) {
    const agreement = await this.getAgreementStep(businessId, user.business);
    const rail = await this.paymentRoutingService.resolveRailForUser(user.id);
    if (rail === 'stripe') {
      return this.buildStripeStatus(user, agreement);
    }
    return this.buildMobileMoneyStatus(user, agreement);
  }

  private async buildMobileMoneyStatus(
    user: any,
    agreement: { complete: boolean }
  ) {
    const identity = await this.getIdentityStep(user.id);
    const [mobilePaymentPhone, catalog] = await Promise.all([
      this.mobilePaymentPhonesService.getBusinessPhoneVerificationStep(
        user.id,
        user.business!.id
      ),
      this.merchantLifecycleService.getCatalogStep(user.business!.id),
    ]);
    const nextAction = this.resolveNextAction(agreement);
    return {
      // Overwritten in getStatus from lifecycle snapshot (DB is_verified).
      is_verified: false,
      accountFullName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      steps: { agreement, identity, mobilePaymentPhone, catalog },
      nextAction,
      requiresMerchantAction: this.requiresMerchantAction(nextAction),
      paymentRail: 'mobile_money' as const,
    };
  }

  private async buildStripeStatus(
    user: any,
    agreement: { complete: boolean }
  ) {
    const stripeConnect = await this.getStripeConnectStep(user.id);
    const nextAction = this.resolveStripeNextAction(agreement, stripeConnect);
    return {
      // Overwritten in getStatus from lifecycle snapshot (DB is_verified).
      is_verified: false,
      accountFullName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      steps: { agreement, stripeConnect },
      nextAction,
      requiresMerchantAction: this.requiresMerchantAction(nextAction),
      paymentRail: 'stripe' as const,
    };
  }

  private requiresMerchantAction(nextAction: VerificationNextAction): boolean {
    return MERCHANT_ACTION_NEXT_ACTIONS.has(nextAction);
  }

  private async getStripeConnectStep(userId: string) {
    const account = await this.stripeConnectService.getByUserId(userId);
    const complete =
      !!account && account.charges_enabled && account.payouts_enabled;
    return {
      complete,
      status: account?.status ?? 'not_started',
      connected: !!account,
    };
  }

  private resolveStripeNextAction(
    agreement: { complete: boolean },
    stripeConnect: { complete: boolean }
  ): VerificationNextAction {
    if (!agreement.complete) return 'sign_agreement';
    if (!stripeConnect.complete) return 'setup_stripe_connect';
    return 'complete';
  }

  private async getAgreementStep(businessId: string, business: any) {
    const contract = await this.businessContractsService.getContractStatus(
      businessId
    );
    // Already-signed BoldSign rows still count after a country switches to in-app.
    if (contract.complete) {
      return {
        complete: true,
        version: contract.version ?? business?.merchant_agreement_version ?? null,
        acceptedAt:
          contract.acceptedAt ?? business?.merchant_agreement_accepted_at ?? null,
        status: contract.status,
        contractId: contract.contractId,
      };
    }
    if (contract.boldSignEnabled) {
      return {
        complete: false,
        version: contract.version,
        acceptedAt: contract.acceptedAt,
        status: contract.status,
        contractId: contract.contractId,
      };
    }
    // In-app path: any recorded acceptance counts (avoid re-forcing on version bumps).
    const version = business?.merchant_agreement_version ?? null;
    const acceptedAt = business?.merchant_agreement_accepted_at ?? null;
    const complete = !!version && !!acceptedAt;
    return { complete, version, acceptedAt };
  }

  private async getIdentityStep(userId: string) {
    const rows = await this.hasuraUserService.executeQuery<{
      user_uploads: Array<{
        id: string;
        is_approved: boolean;
        note: string | null;
        document_type: { name: string };
      }>;
    }>(
      `query IdDocs($userId: uuid!, $names: [String!]) {
        user_uploads(
          where: {
            user_id: { _eq: $userId }
            document_type: { name: { _in: $names } }
          }
          order_by: { created_at: desc }
        ) {
          id
          is_approved
          note
          document_type { name }
        }
      }`,
      { userId, names: ID_DOC_NAMES }
    );
    const uploads = rows.user_uploads ?? [];
    if (!uploads.length) {
      return {
        complete: false,
        status: 'missing' as const,
        uploadId: null,
        rejectionReason: null,
      };
    }
    const approved = uploads.find((u) => u.is_approved);
    if (approved) {
      return {
        complete: true,
        status: 'approved' as const,
        uploadId: approved.id,
        rejectionReason: null,
      };
    }
    const latest = uploads[0];
    // Admin rejections store note as `[REJECTED] …` (see formatIdRejectionNote).
    const rejectionReason = parseIdRejectionReason(latest?.note);
    if (rejectionReason) {
      return {
        complete: false,
        status: 'rejected' as const,
        uploadId: latest.id,
        rejectionReason,
      };
    }
    return {
      complete: true,
      status: 'pending' as const,
      uploadId: latest.id,
      rejectionReason: null,
    };
  }

  private resolveNextAction(agreement: {
    complete: boolean;
  }): VerificationNextAction {
    if (!agreement.complete) return 'sign_agreement';
    return 'complete';
  }

  /** Focused setup until the merchant agreement is signed. */
  private resolveIsOnboarding(
    lifecycleStatus: string,
    base: {
      steps?: {
        agreement?: { complete?: boolean };
      };
    }
  ): boolean {
    if (lifecycleStatus === 'active' || lifecycleStatus === 'suspended') {
      return false;
    }
    return base.steps?.agreement?.complete !== true;
  }

  private async insertAcceptance(params: {
    businessId: string;
    dto: AcceptMerchantAgreementDto;
    legalName: string;
    user: any;
    ipAddress?: string;
    userAgent?: string;
    pdfUploadId: string;
    acceptedAt: string;
    countryCode: string | null;
  }) {
    const mutation = `
      mutation InsertAcceptance($row: business_merchant_agreement_acceptances_insert_input!) {
        insert_business_merchant_agreement_acceptances_one(object: $row) {
          id
          accepted_at
        }
      }
    `;
    const row = {
      business_id: params.businessId,
      user_id: params.user.id ?? null,
      agreement_version: MERCHANT_AGREEMENT_VERSION,
      signer_legal_name: params.legalName,
      signer_email: params.user.email ?? '',
      business_name: params.user.business.name,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      country_code: params.countryCode,
      device_info: params.dto.deviceInfo ?? null,
      pdf_upload_id: params.pdfUploadId,
      accepted_at: params.acceptedAt,
    };
    const res = await this.hasuraSystemService.executeMutation(mutation, { row });
    await this.hasuraSystemService.executeMutation(
      `mutation UpdBiz($id: uuid!, $v: String!, $at: timestamptz!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _set: { merchant_agreement_version: $v, merchant_agreement_accepted_at: $at }
        ) { id }
      }`,
      {
        id: params.businessId,
        v: MERCHANT_AGREEMENT_VERSION,
        at: params.acceptedAt,
      }
    );
    return res.insert_business_merchant_agreement_acceptances_one;
  }
}
