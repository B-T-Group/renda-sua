jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PDF_UNAVAILABLE_MESSAGE } from '../pdf/pdf-endpoint-error.util';
import { BusinessVerificationService } from './business-verification.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { MobilePaymentPhonesService } from '../mobile-payment-phones/mobile-payment-phones.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { BusinessContractsService } from '../business-contracts/business-contracts.service';

describe('BusinessVerificationService MoMo ID status', () => {
  let service: BusinessVerificationService;
  let merchantLifecycle: {
    recompute: jest.Mock;
    getBusinessSnapshot: jest.Mock;
    getCatalogStep: jest.Mock;
    getLatestSuspension: jest.Mock;
    upsertPaymentAccount: jest.Mock;
  };
  let hasuraUser: { executeQuery: jest.Mock; getUser: jest.Mock };
  let paymentRouting: { resolveRailForUser: jest.Mock };
  let mobilePhones: { getBusinessPhoneVerificationStep: jest.Mock };
  let contracts: { getContractStatus: jest.Mock };
  let launchPromo: { getSlotForBusiness: jest.Mock };

  beforeEach(() => {
    merchantLifecycle = {
      recompute: jest.fn().mockResolvedValue(null),
      getBusinessSnapshot: jest.fn().mockResolvedValue({
        lifecycle_status: 'active',
        is_storefront_visible: true,
        can_accept_orders: true,
        is_verified: true,
      }),
      getCatalogStep: jest.fn().mockResolvedValue({
        complete: true,
        hasLocation: true,
        hasActiveInventory: true,
      }),
      getLatestSuspension: jest.fn().mockResolvedValue(null),
      upsertPaymentAccount: jest.fn().mockResolvedValue(undefined),
    };
    hasuraUser = {
      getUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        business: {
          id: 'biz-1',
          is_verified: false,
          name: 'Ada Shop',
          merchant_agreement_version: 'v2',
          merchant_agreement_accepted_at: '2026-08-01T00:00:00Z',
        },
      }),
      executeQuery: jest.fn().mockResolvedValue({
        user_uploads: [
          {
            id: 'upload-1',
            is_approved: true,
            note: null,
            document_type: { name: 'id_card' },
          },
        ],
      }),
    };
    paymentRouting = {
      resolveRailForUser: jest.fn().mockResolvedValue('mobile_money'),
    };
    mobilePhones = {
      getBusinessPhoneVerificationStep: jest.fn().mockResolvedValue({
        complete: true,
        status: 'verified',
      }),
    };
    contracts = {
      getContractStatus: jest.fn().mockResolvedValue({
        complete: true,
        boldSignEnabled: false,
        version: 'v2',
        acceptedAt: '2026-08-01T00:00:00Z',
        status: 'accepted',
        contractId: null,
      }),
    };
    launchPromo = {
      getSlotForBusiness: jest.fn().mockResolvedValue(null),
    };

    service = new BusinessVerificationService(
      hasuraUser as unknown as HasuraUserService,
      {} as HasuraSystemService,
      {} as any,
      {} as any,
      paymentRouting as unknown as PaymentRoutingService,
      {} as any,
      merchantLifecycle as unknown as MerchantLifecycleService,
      contracts as unknown as BusinessContractsService,
      mobilePhones as unknown as MobilePaymentPhonesService,
      {} as any,
      launchPromo as any,
      { getS3Client: jest.fn() } as any
    );
  });

  it('returns DB is_verified from lifecycle snapshot after agreement', async () => {
    const status = await service.getStatus();

    expect(merchantLifecycle.upsertPaymentAccount).not.toHaveBeenCalled();
    expect(status.is_verified).toBe(true);
    expect(status.nextAction).toBe('complete');
    expect(status.isOnboarding).toBe(false);
  });

  it('includes phone and catalog steps while ID is optional for the badge', async () => {
    const status = await service.getStatus();

    expect(status.steps.identity.status).toBe('approved');
    expect(status.steps.mobilePaymentPhone.status).toBe('verified');
    expect(status.steps.catalog.complete).toBe(true);
    expect(status.nextAction).toBe('complete');
  });

  it('ends onboarding after agreement even without approved ID', async () => {
    merchantLifecycle.getBusinessSnapshot.mockResolvedValue({
      lifecycle_status: 'active',
      is_storefront_visible: true,
      can_accept_orders: true,
      is_verified: false,
    });
    hasuraUser.executeQuery.mockResolvedValue({ user_uploads: [] });

    const status = await service.getStatus();

    expect(status.is_verified).toBe(false);
    expect(status.nextAction).toBe('complete');
    expect(status.isOnboarding).toBe(false);
    expect(status.requiresMerchantAction).toBe(false);
  });
});

describe('BusinessVerificationService Stripe Connect next action', () => {
  let service: BusinessVerificationService;
  let merchantLifecycle: {
    recompute: jest.Mock;
    getBusinessSnapshot: jest.Mock;
    getLatestSuspension: jest.Mock;
  };
  let hasuraUser: { getUser: jest.Mock };
  let paymentRouting: { resolveRailForUser: jest.Mock };
  let stripeConnect: { getByUserId: jest.Mock };
  let contracts: { getContractStatus: jest.Mock };
  let launchPromo: { getSlotForBusiness: jest.Mock };

  beforeEach(() => {
    merchantLifecycle = {
      recompute: jest.fn().mockResolvedValue(null),
      getBusinessSnapshot: jest.fn().mockResolvedValue({
        lifecycle_status: 'active',
        is_storefront_visible: true,
        can_accept_orders: true,
        is_verified: true,
      }),
      getLatestSuspension: jest.fn().mockResolvedValue(null),
    };
    hasuraUser = {
      getUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        first_name: 'Stripe',
        last_name: 'Merchant',
        email: 'stripe@example.com',
        business: {
          id: 'biz-stripe',
          name: 'Stripe Shop',
          merchant_agreement_version: 'v2',
          merchant_agreement_accepted_at: '2026-08-01T00:00:00Z',
        },
      }),
    };
    paymentRouting = {
      resolveRailForUser: jest.fn().mockResolvedValue('stripe'),
    };
    stripeConnect = {
      getByUserId: jest.fn(),
    };
    contracts = {
      getContractStatus: jest.fn().mockResolvedValue({
        complete: true,
        boldSignEnabled: false,
        version: 'v2',
        acceptedAt: '2026-08-01T00:00:00Z',
        status: 'accepted',
        contractId: null,
      }),
    };
    launchPromo = {
      getSlotForBusiness: jest.fn().mockResolvedValue(null),
    };

    service = new BusinessVerificationService(
      hasuraUser as unknown as HasuraUserService,
      {} as HasuraSystemService,
      {} as any,
      {} as any,
      paymentRouting as unknown as PaymentRoutingService,
      stripeConnect as any,
      merchantLifecycle as unknown as MerchantLifecycleService,
      contracts as unknown as BusinessContractsService,
      {} as any,
      {} as any,
      launchPromo as any,
      { getS3Client: jest.fn() } as any
    );
  });

  it('returns sign_agreement when agreement is not complete', async () => {
    contracts.getContractStatus.mockResolvedValue({
      complete: false,
      boldSignEnabled: false,
      version: null,
      acceptedAt: null,
      status: null,
      contractId: null,
    });
    hasuraUser.getUser.mockResolvedValue({
      id: 'user-1',
      first_name: 'Stripe',
      last_name: 'Merchant',
      email: 'stripe@example.com',
      business: {
        id: 'biz-stripe',
        name: 'Stripe Shop',
        merchant_agreement_version: null,
        merchant_agreement_accepted_at: null,
      },
    });

    const status = await service.getStatus();

    expect(status.nextAction).toBe('sign_agreement');
    expect(status.requiresMerchantAction).toBe(true);
    expect(status.paymentRail).toBe('stripe');
  });

  it('returns setup_stripe_connect when agreement is complete but Connect is not', async () => {
    stripeConnect.getByUserId.mockResolvedValue({
      id: 'acct_123',
      status: 'pending',
      charges_enabled: false,
      payouts_enabled: false,
    });

    const status = await service.getStatus();

    expect(status.nextAction).toBe('setup_stripe_connect');
    expect(status.requiresMerchantAction).toBe(true);
    expect(status.paymentRail).toBe('stripe');
    expect(status.steps.stripeConnect.complete).toBe(false);
    expect(status.steps.stripeConnect.connected).toBe(true);
  });

  it('returns setup_stripe_connect when charges enabled but payouts disabled', async () => {
    stripeConnect.getByUserId.mockResolvedValue({
      id: 'acct_123',
      status: 'pending',
      charges_enabled: true,
      payouts_enabled: false,
    });

    const status = await service.getStatus();

    expect(status.nextAction).toBe('setup_stripe_connect');
    expect(status.requiresMerchantAction).toBe(true);
    expect(status.steps.stripeConnect.complete).toBe(false);
  });

  it('returns setup_stripe_connect when payouts enabled but charges disabled', async () => {
    stripeConnect.getByUserId.mockResolvedValue({
      id: 'acct_123',
      status: 'pending',
      charges_enabled: false,
      payouts_enabled: true,
    });

    const status = await service.getStatus();

    expect(status.nextAction).toBe('setup_stripe_connect');
    expect(status.requiresMerchantAction).toBe(true);
    expect(status.steps.stripeConnect.complete).toBe(false);
  });

  it('returns complete when both charges and payouts are enabled', async () => {
    stripeConnect.getByUserId.mockResolvedValue({
      id: 'acct_123',
      status: 'active',
      charges_enabled: true,
      payouts_enabled: true,
    });

    const status = await service.getStatus();

    expect(status.nextAction).toBe('complete');
    expect(status.requiresMerchantAction).toBe(false);
    expect(status.steps.stripeConnect.complete).toBe(true);
  });

  it('returns setup_stripe_connect when Connect account does not exist', async () => {
    stripeConnect.getByUserId.mockResolvedValue(null);

    const status = await service.getStatus();

    expect(status.nextAction).toBe('setup_stripe_connect');
    expect(status.requiresMerchantAction).toBe(true);
    expect(status.steps.stripeConnect.complete).toBe(false);
    expect(status.steps.stripeConnect.connected).toBe(false);
    expect(status.steps.stripeConnect.status).toBe('not_started');
  });
});

describe('BusinessVerificationService.acceptAgreement PDF decoupling', () => {
  const VERSION = '2026-09-2';
  let service: BusinessVerificationService;
  let hasuraUser: { getUser: jest.Mock };
  let hasuraSystem: { executeMutation: jest.Mock; executeQuery: jest.Mock };
  let pdfService: { generateMerchantAgreementPdf: jest.Mock };
  let notifications: { sendMerchantAgreementCopyEmail: jest.Mock };
  let merchantLifecycle: { recompute: jest.Mock };
  let contracts: { isBoldSignEnabledForBusiness: jest.Mock };
  let agreementProvider: { getBusinessCountryCode: jest.Mock };
  let aws: { getS3Client: jest.Mock };

  beforeEach(() => {
    hasuraUser = {
      getUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'ada@example.com',
        preferred_language: 'en',
        business: {
          id: 'biz-1',
          name: 'Ada Shop',
          merchant_agreement_version: null,
        },
      }),
    };
    hasuraSystem = {
      executeMutation: jest
        .fn()
        .mockResolvedValueOnce({
          insert_business_merchant_agreement_acceptances_one: {
            id: 'acc-1',
            accepted_at: '2026-09-17T00:00:00.000Z',
          },
        })
        .mockResolvedValue({ update_businesses_by_pk: { id: 'biz-1' } }),
      executeQuery: jest.fn(),
    };
    pdfService = {
      generateMerchantAgreementPdf: jest.fn(),
    };
    notifications = {
      sendMerchantAgreementCopyEmail: jest.fn().mockResolvedValue(undefined),
    };
    merchantLifecycle = {
      recompute: jest.fn().mockResolvedValue(null),
    };
    contracts = {
      isBoldSignEnabledForBusiness: jest.fn().mockResolvedValue(false),
    };
    agreementProvider = {
      getBusinessCountryCode: jest.fn().mockResolvedValue('CM'),
    };
    aws = {
      getS3Client: jest.fn().mockReturnValue({
        send: jest.fn().mockResolvedValue({}),
      }),
    };

    service = new BusinessVerificationService(
      hasuraUser as any,
      hasuraSystem as any,
      pdfService as any,
      notifications as any,
      {} as any,
      {} as any,
      merchantLifecycle as any,
      contracts as any,
      {} as any,
      agreementProvider as any,
      {} as any,
      aws as any
    );
  });

  it('still completes signature when PDFEndpoint fails', async () => {
    pdfService.generateMerchantAgreementPdf.mockRejectedValue(
      new Error('PDFEndpoint 403')
    );

    const result = await service.acceptAgreement(
      { legalName: 'Ada Lovelace', agreementVersion: VERSION },
      '127.0.0.1',
      'jest'
    );

    expect(result.pdfGenerated).toBe(false);
    expect(result.pdfUploadId).toBeNull();
    expect(result.acceptance.id).toBe('acc-1');
    expect(hasuraSystem.executeMutation).toHaveBeenCalled();
    expect(merchantLifecycle.recompute).toHaveBeenCalledWith(
      'biz-1',
      'merchant_agreement_accepted'
    );
    expect(notifications.sendMerchantAgreementCopyEmail).toHaveBeenCalledWith(
      expect.objectContaining({ pdfGenerated: false })
    );
  });

  it('links pdf_upload_id when PDF generation succeeds', async () => {
    pdfService.generateMerchantAgreementPdf.mockResolvedValue({ id: 'pdf-1' });
    hasuraSystem.executeMutation
      .mockReset()
      .mockResolvedValueOnce({
        insert_business_merchant_agreement_acceptances_one: {
          id: 'acc-1',
          accepted_at: '2026-09-17T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({ update_businesses_by_pk: { id: 'biz-1' } })
      .mockResolvedValueOnce({
        update_business_merchant_agreement_acceptances_by_pk: { id: 'acc-1' },
      });

    const result = await service.acceptAgreement(
      {
        legalName: 'Ada Lovelace',
        agreementVersion: VERSION,
        signatureBase64: 'aaaa',
      },
      undefined,
      undefined
    );

    expect(result.pdfGenerated).toBe(true);
    expect(result.pdfUploadId).toBe('pdf-1');
    expect(notifications.sendMerchantAgreementCopyEmail).toHaveBeenCalledWith(
      expect.objectContaining({ pdfGenerated: true })
    );
    expect(hasuraSystem.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SetPdf'),
      expect.objectContaining({ id: 'acc-1', pdfId: 'pdf-1' })
    );
  });

  it('still reports pdfGenerated when linking pdf_upload_id fails', async () => {
    pdfService.generateMerchantAgreementPdf.mockResolvedValue({ id: 'pdf-2' });
    hasuraSystem.executeMutation
      .mockReset()
      .mockResolvedValueOnce({
        insert_business_merchant_agreement_acceptances_one: {
          id: 'acc-1',
          accepted_at: '2026-09-17T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({ update_businesses_by_pk: { id: 'biz-1' } })
      .mockRejectedValueOnce(new Error('Hasura link failed'));

    const result = await service.acceptAgreement(
      {
        legalName: 'Ada Lovelace',
        agreementVersion: VERSION,
        signatureBase64: 'aaaa',
      },
      undefined,
      undefined
    );

    expect(result.pdfGenerated).toBe(true);
    expect(result.pdfUploadId).toBe('pdf-2');
    expect(notifications.sendMerchantAgreementCopyEmail).toHaveBeenCalledWith(
      expect.objectContaining({ pdfGenerated: true })
    );
  });

  it('still completes when PDF throws HttpException', async () => {
    pdfService.generateMerchantAgreementPdf.mockRejectedValue(
      new HttpException(PDF_UNAVAILABLE_MESSAGE, HttpStatus.SERVICE_UNAVAILABLE)
    );

    const result = await service.acceptAgreement(
      { legalName: 'Ada Lovelace', agreementVersion: VERSION },
      '127.0.0.1',
      'jest'
    );

    expect(result.pdfGenerated).toBe(false);
    expect(result.pdfUploadId).toBeNull();
    expect(result.acceptance.id).toBe('acc-1');
    expect(notifications.sendMerchantAgreementCopyEmail).toHaveBeenCalledWith(
      expect.objectContaining({ pdfGenerated: false })
    );
  });

  it('still completes when the agreement email send fails', async () => {
    pdfService.generateMerchantAgreementPdf.mockRejectedValue(
      new Error('PDFEndpoint 403')
    );
    notifications.sendMerchantAgreementCopyEmail.mockRejectedValue(
      new Error('ses down')
    );

    const result = await service.acceptAgreement(
      { legalName: 'Ada Lovelace', agreementVersion: VERSION },
      '127.0.0.1',
      'jest'
    );

    expect(result.acceptance.id).toBe('acc-1');
    expect(result.pdfGenerated).toBe(false);
    expect(merchantLifecycle.recompute).toHaveBeenCalled();
  });
});

describe('BusinessVerificationService merchant agreement PDF retry', () => {
  const VERSION = '2026-09-2';
  let service: BusinessVerificationService;
  let hasuraUser: { getUser: jest.Mock };
  let hasuraSystem: { executeMutation: jest.Mock; executeQuery: jest.Mock };
  let pdfService: { generateMerchantAgreementPdf: jest.Mock };
  let aws: { getS3Client: jest.Mock };

  function acceptanceRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'acc-1',
      accepted_at: '2026-09-17T00:00:00.000Z',
      pdf_upload_id: null,
      signature_image_key: null,
      business_id: 'biz-1',
      business_name: 'Ada Shop',
      signer_legal_name: 'Ada Lovelace',
      signer_email: 'ada@example.com',
      country_code: 'CM',
      agreement_version: VERSION,
      ...overrides,
    };
  }

  beforeEach(() => {
    hasuraUser = {
      getUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'ada@example.com',
        preferred_language: 'fr-CM',
        business: { id: 'biz-1', name: 'Ada Shop' },
      }),
    };
    hasuraSystem = {
      executeMutation: jest.fn(),
      executeQuery: jest.fn(),
    };
    pdfService = {
      generateMerchantAgreementPdf: jest.fn(),
    };
    aws = {
      getS3Client: jest.fn().mockReturnValue({
        send: jest.fn(),
      }),
    };
    service = new BusinessVerificationService(
      hasuraUser as any,
      hasuraSystem as any,
      pdfService as any,
      { sendMerchantAgreementCopyEmail: jest.fn() } as any,
      {} as any,
      {} as any,
      { recompute: jest.fn() } as any,
      { isBoldSignEnabledForBusiness: jest.fn() } as any,
      {} as any,
      { getBusinessCountryCode: jest.fn() } as any,
      {} as any,
      aws as any
    );
  });

  it('returns the existing PDF without regenerating', async () => {
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_merchant_agreement_acceptances_by_pk: acceptanceRow({
        pdf_upload_id: 'pdf-existing',
      }),
    });

    await expect(service.retryMerchantAgreementPdf('acc-1')).resolves.toEqual({
      pdfUploadId: 'pdf-existing',
      pdfGenerated: true,
    });
    expect(pdfService.generateMerchantAgreementPdf).not.toHaveBeenCalled();
  });

  it('returns 404 when the acceptance belongs to another business', async () => {
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_merchant_agreement_acceptances_by_pk: acceptanceRow({
        business_id: 'other-biz',
      }),
    });

    await expect(service.retryMerchantAgreementPdf('acc-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('rejects retry when the stored signature cannot be loaded', async () => {
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_merchant_agreement_acceptances_by_pk: acceptanceRow({
        signature_image_key: 'business/user-1/sig.png',
      }),
    });
    aws.getS3Client().send.mockRejectedValue(new Error('s3 miss'));

    await expect(service.retryMerchantAgreementPdf('acc-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(pdfService.generateMerchantAgreementPdf).not.toHaveBeenCalled();
  });

  it('rejects retry when PDF generation is still unavailable', async () => {
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_merchant_agreement_acceptances_by_pk: acceptanceRow(),
    });
    pdfService.generateMerchantAgreementPdf.mockRejectedValue(
      new Error('PDFEndpoint 403')
    );

    await expect(service.retryMerchantAgreementPdf('acc-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('links a newly generated PDF when the first accept link was missed', async () => {
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_merchant_agreement_acceptances_by_pk: acceptanceRow(),
    });
    pdfService.generateMerchantAgreementPdf.mockResolvedValue({ id: 'pdf-9' });
    hasuraSystem.executeMutation.mockRejectedValueOnce(
      new Error('first link failed')
    );
    hasuraSystem.executeMutation.mockResolvedValueOnce({
      update_business_merchant_agreement_acceptances_by_pk: { id: 'acc-1' },
    });

    await expect(service.retryMerchantAgreementPdf('acc-1')).resolves.toEqual({
      pdfUploadId: 'pdf-9',
      pdfGenerated: true,
    });
    expect(hasuraSystem.executeMutation).toHaveBeenCalledTimes(2);
  });

  it('admin retry uses the owner locale and upload user id', async () => {
    hasuraSystem.executeQuery
      .mockResolvedValueOnce({
        business_merchant_agreement_acceptances: [acceptanceRow()],
      })
      .mockResolvedValueOnce({
        businesses_by_pk: {
          user: { id: 'owner-9', preferred_language: 'fr' },
        },
      });
    pdfService.generateMerchantAgreementPdf.mockResolvedValue({ id: 'pdf-admin' });
    hasuraSystem.executeMutation.mockResolvedValue({
      update_business_merchant_agreement_acceptances_by_pk: { id: 'acc-1' },
    });

    await expect(
      service.retryMerchantAgreementPdfAsAdmin('biz-1')
    ).resolves.toEqual({
      pdfUploadId: 'pdf-admin',
      pdfGenerated: true,
    });
    expect(pdfService.generateMerchantAgreementPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'fr',
        ownerUserId: 'owner-9',
      })
    );
  });

  it('admin retry 404s when the business has no owner', async () => {
    hasuraSystem.executeQuery
      .mockResolvedValueOnce({
        business_merchant_agreement_acceptances: [acceptanceRow()],
      })
      .mockResolvedValueOnce({ businesses_by_pk: { user: null } });

    await expect(
      service.retryMerchantAgreementPdfAsAdmin('biz-1')
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(pdfService.generateMerchantAgreementPdf).not.toHaveBeenCalled();
  });

  it('admin retry 404s when no acceptance exists', async () => {
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_merchant_agreement_acceptances: [],
    });

    await expect(
      service.retryMerchantAgreementPdfAsAdmin('biz-1')
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
