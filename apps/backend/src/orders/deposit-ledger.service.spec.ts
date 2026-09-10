import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DepositLedgerService } from './deposit-ledger.service';

describe('DepositLedgerService', () => {
  let service: DepositLedgerService;
  let accountsService: jest.Mocked<AccountsService>;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositLedgerService,
        {
          provide: AccountsService,
          useValue: {
            registerDepositIfNotExists: jest.fn(),
            registerHoldIfNotExists: jest.fn(),
            registerReleaseIfNotExists: jest.fn(),
            registerPaymentIfNotExists: jest.fn(),
            hasTransactionForReference: jest.fn(),
          },
        },
        {
          provide: HasuraSystemService,
          useValue: {
            getRendasuaHQUser: jest.fn(),
            getAccount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(DepositLedgerService);
    accountsService = module.get(AccountsService);
    hasuraSystemService = module.get(HasuraSystemService);
  });

  const txnId = '99a3bd0d-262c-4d4c-80da-5071b4bfbfa2';

  describe('creditAndHoldDeposit', () => {
    it('credits then holds; throws if hold fails', async () => {
      accountsService.registerDepositIfNotExists.mockResolvedValue({
        success: true,
      });
      accountsService.registerHoldIfNotExists.mockResolvedValue({
        success: false,
        error: 'insufficient',
      });

      await expect(
        service.creditAndHoldDeposit({
          clientAccountId: 'acct-1',
          amount: 150,
          orderNumber: '123',
          depositTransactionId: txnId,
        })
      ).rejects.toThrow(/hold failed/i);

      expect(accountsService.registerDepositIfNotExists).toHaveBeenCalled();
      expect(accountsService.registerHoldIfNotExists).toHaveBeenCalledWith({
        accountId: 'acct-1',
        amount: 150,
        referenceId: txnId,
        memo: 'Deposit hold for order 123',
      });
    });
  });

  describe('releaseDepositToAvailable', () => {
    it('ensures hold then releases', async () => {
      accountsService.hasTransactionForReference.mockResolvedValue(true);
      accountsService.registerReleaseIfNotExists.mockResolvedValue({
        success: true,
      });

      await service.releaseDepositToAvailable({
        clientAccountId: 'acct-1',
        amount: 150,
        orderNumber: '123',
        depositTransactionId: txnId,
      });

      expect(accountsService.registerReleaseIfNotExists).toHaveBeenCalledWith({
        accountId: 'acct-1',
        amount: 150,
        referenceId: txnId,
        memo: 'Deposit refund released for order 123',
      });
    });
  });

  describe('forfeitDepositToHq', () => {
    it('releases, debits client, credits HQ', async () => {
      accountsService.hasTransactionForReference.mockResolvedValue(true);
      accountsService.registerReleaseIfNotExists.mockResolvedValue({
        success: true,
      });
      accountsService.registerPaymentIfNotExists.mockResolvedValue({
        success: true,
      });
      hasuraSystemService.getRendasuaHQUser.mockResolvedValue({
        id: 'hq-user',
      } as any);
      hasuraSystemService.getAccount.mockResolvedValue({ id: 'hq-acct' } as any);
      accountsService.registerDepositIfNotExists.mockResolvedValue({
        success: true,
      });

      await service.forfeitDepositToHq({
        clientAccountId: 'acct-1',
        amount: 150,
        currency: 'XAF',
        orderNumber: '123',
        depositTransactionId: txnId,
      });

      expect(accountsService.registerPaymentIfNotExists).toHaveBeenCalledWith({
        accountId: 'acct-1',
        amount: 150,
        referenceId: txnId,
        memo: 'Deposit forfeited for order 123',
      });
      expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith({
        accountId: 'hq-acct',
        amount: 150,
        referenceId: txnId,
        memo: 'Deposit forfeited from order 123',
      });
    });

    it('skips client debit when payment already exists for deposit ref', async () => {
      accountsService.hasTransactionForReference.mockResolvedValue(true);
      accountsService.registerReleaseIfNotExists.mockResolvedValue({
        success: true,
        alreadyExists: true,
      });
      accountsService.registerPaymentIfNotExists.mockResolvedValue({
        success: true,
        alreadyExists: true,
      });
      hasuraSystemService.getRendasuaHQUser.mockResolvedValue({
        id: 'hq-user',
      } as any);
      hasuraSystemService.getAccount.mockResolvedValue({ id: 'hq-acct' } as any);
      accountsService.registerDepositIfNotExists.mockResolvedValue({
        success: true,
        alreadyExists: true,
      });

      await expect(
        service.forfeitDepositToHq({
          clientAccountId: 'acct-1',
          amount: 150,
          currency: 'XAF',
          orderNumber: '123',
          depositTransactionId: txnId,
        })
      ).resolves.toBeUndefined();

      expect(accountsService.registerPaymentIfNotExists).toHaveBeenCalledTimes(1);
    });
  });
});
