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

describe('MobilePaymentsService.resolveAdminIntegrationProvider', () => {
  const service = Object.create(
    MobilePaymentsService.prototype
  ) as MobilePaymentsService;

  it('sends every +237 number to FreemoPay for payment and callback', async () => {
    const phone = '+237640448217';
    await expect(service.resolveProviderFromRequest({ customerPhone: phone })).resolves.toBe(
      'freemopay'
    );
    await expect(service.resolveAdminIntegrationProvider(phone, 'mypvit')).resolves.toBe(
      'freemopay'
    );
  });

  it('keeps a stored FreemoPay rail when the phone is not Cameroon', async () => {
    await expect(
      service.resolveAdminIntegrationProvider('+24106123456', 'freemopay')
    ).resolves.toBe('freemopay');
    await expect(
      service.resolveProviderFromRequest({
        customerPhone: '+24106123456',
        provider: 'freemopay',
      })
    ).resolves.toBe('freemopay');
  });

  it('lets a Cameroon country code beat a stored MyPVit rail and the item country', async () => {
    await expect(
      service.resolveProviderFromRequest({
        customerPhone: '+237 640 44 82 17',
        provider: 'mypvit',
        itemCountry: 'GA',
      })
    ).resolves.toBe('freemopay');
    await expect(
      service.resolveProviderFromRequest({
        customerPhone: '00237692168717',
        provider: 'airtel',
        itemCountry: 'ga',
      })
    ).resolves.toBe('freemopay');
    await expect(
      service.resolveAdminIntegrationProvider('00237692168717', 'mypvit')
    ).resolves.toBe('freemopay');
  });

  it('keeps a direct MTN or Orange rail ahead of a Cameroon number', async () => {
    await expect(
      service.resolveProviderFromRequest({
        customerPhone: '+237640448217',
        provider: 'mtn',
        itemCountry: 'GA',
      })
    ).resolves.toBe('mtn');
    await expect(
      service.resolveProviderFromRequest({
        customerPhone: '+237692168717',
        provider: 'orange',
      })
    ).resolves.toBe('orange');
  });

  it('uses the item country when the number has no Cameroon country code', async () => {
    await expect(
      service.resolveProviderFromRequest({
        customerPhone: '692168717',
        provider: 'mypvit',
        itemCountry: 'GA',
      })
    ).resolves.toBe('mypvit');
    await expect(
      service.resolveProviderFromRequest({
        customerPhone: '+24106123456',
        itemCountry: 'CM',
      })
    ).resolves.toBe('freemopay');
    await expect(service.resolveProviderFromRequest({})).resolves.toBe('mypvit');
    await expect(
      service.resolveProviderFromRequest({
        customerPhone: '692168717',
        itemCountry: 'Cameroon',
      })
    ).resolves.toBe('freemopay');
    await expect(
      service.resolveProviderFromRequest({
        customerPhone: '692168717',
        itemCountry: 'Cameroun',
      })
    ).resolves.toBe('freemopay');
  });

  it('sends a local Cameroon mobile to FreemoPay only with no item country', async () => {
    expect(service.getProvider('692168717')).toBe('freemopay');
    expect(service.getProvider('+24106123456')).toBe('mypvit');
    await expect(
      service.resolveProviderFromRequest({ customerPhone: '692168717' })
    ).resolves.toBe('freemopay');
  });
});
