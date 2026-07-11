import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import * as fs from 'fs';
import Mustache from 'mustache';
import * as path from 'path';
import { MERCHANT_AGREEMENT_VERSION } from '../agreements/merchant-agreement.constants';
import { BusinessContractsService } from '../business-contracts/business-contracts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../pdf/pdf.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { StripeConnectService } from '../stripe-payments/stripe-connect.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { AcceptMerchantAgreementDto } from './dto/accept-merchant-agreement.dto';

export type VerificationNextAction =
  | 'sign_agreement'
  | 'upload_id'
  | 'setup_stripe_connect'
  | 'publish_catalog'
  | 'pending_review'
  | 'complete';

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
    private readonly businessContractsService: BusinessContractsService
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
    return {
      ...base,
      lifecycle_status: lifecycle?.lifecycle_status ?? 'created',
      is_storefront_visible: lifecycle?.is_storefront_visible ?? false,
      can_accept_orders: lifecycle?.can_accept_orders ?? false,
      contract: await this.businessContractsService.getContractStatus(businessId),
    };
  }

  async getMerchantAgreementForUser() {
    const user = await this.requireBusinessUser();
    const lang = user.preferred_language?.startsWith('fr') ? 'fr' : 'en';
    const html = this.renderAgreementTemplate(lang, {
      businessName: user.business?.name ?? '',
      signerLegalName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      signerEmail: user.email ?? '',
      acceptedAt:
        lang === 'fr' ? 'À la signature électronique' : 'Upon electronic acceptance',
      agreementVersion: MERCHANT_AGREEMENT_VERSION,
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
    if (this.businessContractsService.isBoldSignEnabled()) {
      throw new BadRequestException(
        'Agreement must be signed via email. Check your inbox for the BoldSign request.'
      );
    }
    const user = await this.requireBusinessUser();
    const business = user.business!;
    if (dto.agreementVersion !== MERCHANT_AGREEMENT_VERSION) {
      throw new BadRequestException('Agreement version is outdated. Please refresh and try again.');
    }
    const biz = business as { merchant_agreement_version?: string | null };
    if (biz.merchant_agreement_version === MERCHANT_AGREEMENT_VERSION) {
      throw new BadRequestException('This agreement version is already accepted.');
    }
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
      `merchant-agreement-v1.${lang}.html`
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
    const adminVerified = user.business?.is_verified === true;
    const identity = await this.getIdentityStep(user.id);
    const nextAction = this.resolveNextAction(adminVerified, agreement, identity);
    return {
      is_verified: adminVerified,
      accountFullName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      steps: { agreement, identity },
      nextAction,
      paymentRail: 'mobile_money' as const,
    };
  }

  private async buildStripeStatus(
    user: any,
    agreement: { complete: boolean }
  ) {
    const businessId = user.business!.id;
    const stripeConnect = await this.getStripeConnectStep(user.id);
    const catalog = await this.merchantLifecycleService.getCatalogStep(businessId);
    const lifecycle = await this.merchantLifecycleService.getBusinessSnapshot(
      businessId
    );
    const canAccept = lifecycle?.can_accept_orders === true;
    const nextAction = this.resolveStripeNextAction(
      agreement,
      stripeConnect,
      catalog,
      canAccept
    );
    return {
      is_verified: canAccept,
      accountFullName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      steps: { agreement, stripeConnect, catalog },
      nextAction,
      paymentRail: 'stripe' as const,
    };
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
    stripeConnect: { complete: boolean },
    catalog: { complete: boolean },
    canAcceptOrders: boolean
  ): VerificationNextAction {
    if (canAcceptOrders) return 'complete';
    if (!agreement.complete) return 'sign_agreement';
    if (!stripeConnect.complete) return 'setup_stripe_connect';
    if (!catalog.complete) return 'publish_catalog';
    return 'pending_review';
  }

  private async getAgreementStep(businessId: string, business: any) {
    const contract = await this.businessContractsService.getContractStatus(
      businessId
    );
    if (contract.boldSignEnabled) {
      return {
        complete: contract.complete,
        version: contract.version,
        acceptedAt: contract.acceptedAt,
        status: contract.status,
        contractId: contract.contractId,
      };
    }
    const version = business?.merchant_agreement_version ?? null;
    const acceptedAt = business?.merchant_agreement_accepted_at ?? null;
    const complete =
      version === MERCHANT_AGREEMENT_VERSION && !!acceptedAt;
    return { complete, version, acceptedAt };
  }

  private async getIdentityStep(userId: string) {
    const rows = await this.hasuraUserService.executeQuery<{
      user_uploads: Array<{
        id: string;
        is_approved: boolean;
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
          document_type { name }
        }
      }`,
      { userId, names: ID_DOC_NAMES }
    );
    const uploads = rows.user_uploads ?? [];
    if (!uploads.length) {
      return { complete: false, status: 'missing' as const, uploadId: null };
    }
    const approved = uploads.find((u) => u.is_approved);
    if (approved) {
      return { complete: true, status: 'approved' as const, uploadId: approved.id };
    }
    return {
      complete: true,
      status: 'pending' as const,
      uploadId: uploads[0].id,
    };
  }

  private resolveNextAction(
    isVerified: boolean,
    agreement: { complete: boolean },
    identity: { complete: boolean; status: string }
  ): VerificationNextAction {
    if (isVerified) return 'complete';
    if (!agreement.complete) return 'sign_agreement';
    if (!identity.complete) return 'upload_id';
    if (identity.status === 'pending') return 'pending_review';
    return 'pending_review';
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
      agreement_version: MERCHANT_AGREEMENT_VERSION,
      signer_legal_name: params.legalName,
      signer_email: params.user.email ?? '',
      business_name: params.user.business.name,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
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
