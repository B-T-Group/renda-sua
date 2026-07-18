import { AccountsService } from './accounts.service';

describe('AccountsService transaction idempotency', () => {
  it('does not register a second transaction for the same ledger key', async () => {
    const hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({
        account_transactions: [{ id: 'existing-transaction' }],
      }),
    };
    const service = new AccountsService(hasuraSystemService as any);
    const register = jest.spyOn(service, 'registerTransaction');

    await expect(
      service.registerTransactionIfMissing({
        accountId: 'account-1',
        amount: 100,
        transactionType: 'deposit',
        referenceId: '9eea761b-b77e-47c4-b494-6002d0f5c478',
      })
    ).resolves.toEqual({ success: true });
    expect(register).not.toHaveBeenCalled();
  });
});
