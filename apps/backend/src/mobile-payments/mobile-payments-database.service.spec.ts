import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';

describe('MobilePaymentsDatabaseService.updateTransaction', () => {
  it('coerces array error_message to text before the Hasura mutation', async () => {
    const executeMutation = jest.fn().mockResolvedValue({
      update_mobile_payment_transactions_by_pk: { id: 'tx-1' },
    });
    const service = new MobilePaymentsDatabaseService({
      executeMutation,
    } as never);

    await service.updateTransaction('tx-1', {
      status: 'failed',
      error_message: ['payer invalid', 'amount invalid'] as unknown as string,
      error_code: 400 as unknown as string,
    });

    expect(executeMutation).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        id: 'tx-1',
        data: expect.objectContaining({
          status: 'failed',
          error_message: 'payer invalid; amount invalid',
          error_code: '400',
        }),
      })
    );
  });
});
