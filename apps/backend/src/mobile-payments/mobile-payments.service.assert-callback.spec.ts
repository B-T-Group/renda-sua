import { MobilePaymentsService } from './mobile-payments.service';

describe('MobilePaymentsService.assertProviderConfirmsCallback', () => {
  function buildService(liveStatus: 'pending' | 'success' | 'failed' | 'cancelled' | 'ambiguous') {
    const service = Object.create(MobilePaymentsService.prototype) as MobilePaymentsService;
    (service as any).resolveAdminIntegrationProvider = jest
      .fn()
      .mockReturnValue('mypvit');
    (service as any).checkTransactionStatus = jest.fn().mockResolvedValue({
      transactionId: 'provider-tx-1',
      status: liveStatus,
      amount: 1000,
      currency: 'XAF',
      reference: 'ref-1',
      provider: 'mypvit',
    });
    return service;
  }

  const tx = {
    id: 'tx-1',
    transaction_id: 'provider-tx-1',
    customer_phone: '+24106123456',
    provider: 'mypvit',
  };

  it('allows SUCCESS when provider reports success', async () => {
    await expect(
      buildService('success').assertProviderConfirmsCallback(tx, 'SUCCESS')
    ).resolves.toBeUndefined();
  });

  it('rejects forged SUCCESS when provider is still pending', async () => {
    await expect(
      buildService('pending').assertProviderConfirmsCallback(tx, 'SUCCESS')
    ).rejects.toThrow(/provider status is pending/i);
  });

  it('rejects SUCCESS when provider transaction_id is missing', async () => {
    await expect(
      buildService('success').assertProviderConfirmsCallback(
        { ...tx, transaction_id: null },
        'SUCCESS'
      )
    ).rejects.toThrow(/missing provider transaction_id/i);
  });

  it('rejects FAILED when provider reports success', async () => {
    await expect(
      buildService('success').assertProviderConfirmsCallback(tx, 'FAILED')
    ).rejects.toThrow(/provider reports success/i);
  });
});
