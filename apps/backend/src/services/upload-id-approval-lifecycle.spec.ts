jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));
jest.mock('../addresses/addresses.service', () => ({
  AddressesService: class AddressesService {},
}));
jest.mock('../business-contracts/business-contracts.service', () => ({
  BusinessContractsService: class BusinessContractsService {},
}));

import { HttpStatus } from '@nestjs/common';
import { UploadService } from './upload.service';

describe('UploadService.approveUpload lifecycle', () => {
  function createService() {
    const hasuraSystem = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    const merchantLifecycle = { recompute: jest.fn().mockResolvedValue({}) };
    const notifications = {
      sendBusinessIdDocumentApprovedEmail: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UploadService(
      {} as any,
      hasuraSystem as any,
      {} as any,
      {} as any,
      notifications as any,
      merchantLifecycle as any
    );
    return { service, hasuraSystem, merchantLifecycle };
  }

  async function flushBackground(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  }

  function mockApproveQueries(
    hasuraSystem: { executeQuery: jest.Mock; executeMutation: jest.Mock },
    options: {
      documentType: string;
      agentId?: string;
      businessId?: string;
      momoVerified?: boolean;
      stripeReady?: boolean;
    }
  ) {
    hasuraSystem.executeMutation.mockImplementation(async (mutation: string) => {
      if (mutation.includes('ApproveUserUpload')) {
        return { update_user_uploads_by_pk: { id: 'upload-1', is_approved: true } };
      }
      if (mutation.includes('SetAgentVerified')) {
        return { update_agents_by_pk: { id: options.agentId, is_verified: true } };
      }
      return {};
    });
    hasuraSystem.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('GetUploadWithType')) {
        return {
          user_uploads_by_pk: {
            user_id: 'user-1',
            document_type: { name: options.documentType },
          },
        };
      }
      if (query.includes('GetAgentByUserId')) {
        return { agents: options.agentId ? [{ id: options.agentId }] : [] };
      }
      if (query.includes('AgentVerifyGate')) {
        return {
          stripe_connect_accounts: options.stripeReady
            ? [{ charges_enabled: true, payouts_enabled: true }]
            : [],
          agents: [
            {
              mobile_payment_phone: { is_verified: options.momoVerified === true },
            },
          ],
        };
      }
      if (query.includes('BusinessByUser')) {
        return {
          businesses: options.businessId ? [{ id: options.businessId }] : [],
        };
      }
      return {};
    });
  }

  it('404s when the upload row cannot be approved', async () => {
    const { service, hasuraSystem } = createService();
    hasuraSystem.executeMutation.mockResolvedValue({
      update_user_uploads_by_pk: null,
    });

    await expect(service.approveUpload('missing')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('recomputes merchant lifecycle and never writes businesses.is_verified', async () => {
    const { service, hasuraSystem, merchantLifecycle } = createService();
    mockApproveQueries(hasuraSystem, {
      documentType: 'passport',
      businessId: 'biz-1',
    });

    await service.approveUpload('upload-1');
    await flushBackground();

    expect(merchantLifecycle.recompute).toHaveBeenCalledWith(
      'biz-1',
      'id_document_change'
    );
    const mutations = hasuraSystem.executeMutation.mock.calls.map(
      ([query]) => String(query)
    );
    expect(
      mutations.some(
        (query) =>
          query.includes('update_businesses') && query.includes('is_verified')
      )
    ).toBe(false);
  });

  it('marks an agent verified only when MoMo or Stripe payouts are ready', async () => {
    const { service, hasuraSystem } = createService();
    mockApproveQueries(hasuraSystem, {
      documentType: 'id_card',
      agentId: 'agent-1',
      momoVerified: true,
    });

    await service.approveUpload('upload-1');
    await flushBackground();

    expect(hasuraSystem.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SetAgentVerified'),
      { agentId: 'agent-1' }
    );
  });

  it('does not mark an agent verified without MoMo or Stripe capability', async () => {
    const { service, hasuraSystem } = createService();
    mockApproveQueries(hasuraSystem, {
      documentType: 'id_card',
      agentId: 'agent-1',
      momoVerified: false,
      stripeReady: false,
    });

    await service.approveUpload('upload-1');
    await flushBackground();

    const mutations = hasuraSystem.executeMutation.mock.calls.map(
      ([query]) => String(query)
    );
    expect(mutations.some((query) => query.includes('SetAgentVerified'))).toBe(
      false
    );
  });
});
