import { ConfigService } from '@nestjs/config';
import { AwsService } from '../aws/aws.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BoldsignClientService } from './boldsign-client.service';
import { BusinessContractsDatabaseService } from './business-contracts-database.service';
import { BusinessContractsService } from './business-contracts.service';
import {
  BusinessContractRow,
  ContractTemplateRow,
} from './business-contracts.types';

jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));

describe('BusinessContractsService', () => {
  let service: BusinessContractsService;
  let db: jest.Mocked<BusinessContractsDatabaseService>;
  let boldsign: jest.Mocked<BoldsignClientService>;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;

  const businessId = 'business-1';
  const signerQueryResult = {
    businesses_by_pk: {
      name: 'Test Business',
      user: {
        email: 'owner@example.com',
        first_name: 'Test',
        last_name: 'Owner',
        preferred_language: 'en',
      },
    },
  };
  const template: ContractTemplateRow = {
    id: 'template-1',
    version: '2026-07',
    boldsign_template_id_en: 'tmpl-en',
    boldsign_template_id_fr: null,
    title: 'Merchant Agreement',
    is_active: true,
    is_legacy: false,
  };

  beforeEach(() => {
    db = buildDatabaseMock();
    boldsign = buildBoldsignMock();
    hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue(signerQueryResult),
    } as unknown as jest.Mocked<HasuraSystemService>;

    service = new BusinessContractsService(
      db,
      boldsign,
      buildAwsMock(),
      hasuraSystemService,
      buildNotificationsMock(),
      buildConfigMock(),
      buildMerchantLifecycleMock()
    );
  });

  it('resumes the existing in-flight contract when insert hits the uniqueness constraint', async () => {
    const existing = makeContract({
      id: 'contract-existing',
      boldsign_document_id: 'pending:business-1:existing',
      status: 'not_sent',
    });
    db.getLatestContract.mockResolvedValue(null);
    db.getInFlightContract
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing);
    db.getActiveTemplate.mockResolvedValue(template);
    db.getTemplateById.mockResolvedValue(template);
    db.insertContract.mockRejectedValueOnce(
      new Error('Uniqueness violation. uq_business_contracts_in_flight')
    );
    boldsign.sendUsingTemplate.mockResolvedValue({ documentId: 'doc-existing' });

    const result = await service.resendContract(businessId);

    expect(result).toMatchObject({
      id: existing.id,
      boldsign_document_id: 'doc-existing',
      status: 'sent',
    });
    expect(db.insertContract).toHaveBeenCalledTimes(1);
    expect(boldsign.sendUsingTemplate).toHaveBeenCalledTimes(1);
    expect(db.updateContract).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({
        boldsign_document_id: 'doc-existing',
        status: 'sent',
      })
    );
  });

  it('cancels a superseded row when saving the BoldSign document hits an in-flight conflict', async () => {
    const inserted = makeContract({
      id: 'contract-new',
      boldsign_document_id: 'pending:business-1:new',
      status: 'not_sent',
    });
    const existing = makeContract({
      id: 'contract-existing',
      boldsign_document_id: 'doc-existing',
      status: 'sent',
    });
    db.getLatestContract.mockResolvedValue(null);
    db.getInFlightContract
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    db.getActiveTemplate.mockResolvedValue(template);
    db.insertContract.mockResolvedValue(inserted);
    db.updateContract
      .mockRejectedValueOnce(new Error('Uniqueness violation'))
      .mockResolvedValueOnce(undefined);
    boldsign.sendUsingTemplate.mockResolvedValue({ documentId: 'doc-new' });

    const result = await service.resendContract(businessId);

    expect(result).toBe(existing);
    expect(db.updateContract).toHaveBeenNthCalledWith(
      1,
      inserted.id,
      expect.objectContaining({
        boldsign_document_id: 'doc-new',
        status: 'sent',
      })
    );
    expect(db.updateContract).toHaveBeenNthCalledWith(
      2,
      inserted.id,
      expect.objectContaining({
        status: 'cancelled',
        failure_reason: expect.stringContaining(existing.id),
      })
    );
    expect(db.updateContract.mock.calls[1][1].failure_reason).toContain('doc-new');
  });
});

function makeContract(
  overrides: Partial<BusinessContractRow> = {}
): BusinessContractRow {
  return {
    id: 'contract-1',
    business_id: businessId,
    contract_template_id: template.id,
    contract_version: template.version,
    boldsign_document_id: 'pending:business-1:1',
    status: 'not_sent',
    signer_name: 'Test Owner',
    signer_email: 'owner@example.com',
    created_at: '2026-07-08T00:00:00.000Z',
    updated_at: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

function buildDatabaseMock(): jest.Mocked<BusinessContractsDatabaseService> {
  return {
    getLatestContract: jest.fn(),
    getInFlightContract: jest.fn(),
    getActiveTemplate: jest.fn(),
    getTemplateById: jest.fn(),
    insertContract: jest.fn(),
    updateContract: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<BusinessContractsDatabaseService>;
}

function buildBoldsignMock(): jest.Mocked<BoldsignClientService> {
  return {
    isConfigured: jest.fn().mockReturnValue(true),
    sendUsingTemplate: jest.fn(),
    remindDocument: jest.fn(),
  } as unknown as jest.Mocked<BoldsignClientService>;
}

function buildAwsMock(): AwsService {
  return {} as AwsService;
}

function buildNotificationsMock(): NotificationsService {
  return {} as NotificationsService;
}

function buildConfigMock(): ConfigService {
  return {
    get: jest.fn().mockReturnValue({
      enabled: true,
      expirationDays: 30,
      reminderIntervalDays: 7,
    }),
  } as unknown as ConfigService;
}

function buildMerchantLifecycleMock() {
  return { recompute: jest.fn() };
}
