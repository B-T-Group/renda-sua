import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderRefundsService } from './order-refunds.service';

jest.mock('../accounts/accounts.service', () => ({
  AccountsService: class AccountsService {},
}));
jest.mock('../hasura/hasura-system.service', () => ({
  HasuraSystemService: class HasuraSystemService {},
}));
jest.mock('../hasura/hasura-user.service', () => ({
  HasuraUserService: class HasuraUserService {},
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AccountsService } = require('../accounts/accounts.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HasuraSystemService } = require('../hasura/hasura-system.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HasuraUserService } = require('../hasura/hasura-user.service');

describe('OrderRefundsService', () => {
  let service: OrderRefundsService;
  let hasuraSystem: jest.Mocked<Pick<HasuraSystemService, 'executeQuery' | 'executeMutation' | 'getAccount'>>;
  let hasuraUser: jest.Mocked<Pick<HasuraUserService, 'getUser' | 'getActivePersonaHeader'>>;

  const businessUser = {
    id: 'biz-user',
    user_type_id: 'business',
    business: { id: 'b1', user_id: 'biz-user' },
    client: null,
    agent: null,
  };

  const clientUser = {
    id: 'cli-user',
    user_type_id: 'client',
    client: { id: 'c1', user_id: 'cli-user' },
    business: null,
    agent: null,
  };

  const orderCtx = {
    id: 'o1',
    order_number: 'ORD-1',
    current_status: 'refund_requested',
    subtotal: 100,
    base_delivery_fee: 0,
    per_km_delivery_fee: 0,
    currency: 'USD',
    completed_at: new Date().toISOString(),
    client_id: 'c1',
    business_id: 'b1',
    client: { user_id: 'u1' },
    business: { user_id: 'biz-user' },
  };

  beforeEach(async () => {
    const mockHasuraSystem = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
      getAccount: jest.fn(),
    };
    const mockHasuraUser = {
      getUser: jest.fn(),
      getActivePersonaHeader: jest.fn().mockReturnValue('business'),
    };
    const mockAccounts = {
      registerTransaction: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderRefundsService,
        { provide: HasuraSystemService, useValue: mockHasuraSystem },
        { provide: HasuraUserService, useValue: mockHasuraUser },
        { provide: AccountsService, useValue: mockAccounts },
      ],
    }).compile();

    service = module.get(OrderRefundsService);
    hasuraSystem = module.get(HasuraSystemService);
    hasuraUser = module.get(HasuraUserService);
  });

  it('approvePartialRefund rejects amount >= subtotal', async () => {
    hasuraUser.getUser.mockResolvedValue(businessUser as never);
    hasuraSystem.executeQuery.mockResolvedValue({ orders_by_pk: orderCtx });

    await expect(
      service.approvePartialRefund('o1', {
        amount: 100,
        inspectionAcknowledged: true,
      })
    ).rejects.toThrow(HttpException);
  });

  it('approvePartialRefund rejects amount <= 0', async () => {
    hasuraUser.getUser.mockResolvedValue(businessUser as never);
    hasuraSystem.executeQuery.mockResolvedValue({ orders_by_pk: orderCtx });

    await expect(
      service.approvePartialRefund('o1', {
        amount: 0,
        inspectionAcknowledged: true,
      })
    ).rejects.toThrow(HttpException);
  });

  it('rejectRefundRequest requires business persona', async () => {
    hasuraUser.getUser.mockResolvedValue(clientUser as never);
    hasuraUser.getActivePersonaHeader.mockReturnValue('client');

    await expect(
      service.rejectRefundRequest('o1', { rejectionReason: 'x' })
    ).rejects.toThrow(HttpException);
  });

  it('approveReplaceItem requires inspection acknowledgment', async () => {
    hasuraUser.getUser.mockResolvedValue(businessUser as never);

    await expect(
      service.approveReplaceItem('o1', { inspectionAcknowledged: false })
    ).rejects.toThrow(HttpException);
  });
});
