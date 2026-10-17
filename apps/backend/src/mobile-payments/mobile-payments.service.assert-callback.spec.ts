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

  describe('FedaPay mismatch HTTP status codes', () => {
    function buildFedaPayService(liveData: { 
      status: string; 
      amount?: number; 
      currency?: string; 
      reference?: string;
    }) {
      const service = Object.create(MobilePaymentsService.prototype) as MobilePaymentsService;
      (service as any).resolveAdminIntegrationProvider = jest.fn().mockReturnValue('fedapay');
      (service as any).checkTransactionStatus = jest.fn().mockResolvedValue({
        transactionId: '12345',
        status: liveData.status,
        amount: liveData.amount ?? 1000,
        currency: liveData.currency ?? 'XOF',
        reference: liveData.reference ?? 'REF-123',
        provider: 'fedapay',
      });
      return service;
    }

    const fedaPayTx = {
      id: 'tx-fedapay-1',
      transaction_id: '12345',
      customer_phone: '+22890123456',
      provider: 'fedapay',
      amount: 1000,
      currency: 'XOF',
      reference: 'REF-123',
    };

    it('returns 409 for amount mismatch', async () => {
      const service = buildFedaPayService({ status: 'success', amount: 2000 });
      
      try {
        await service.assertProviderConfirmsCallback(fedaPayTx, 'SUCCESS');
        fail('Should have thrown HttpException');
      } catch (error: any) {
        expect(error.getStatus()).toBe(409); // CONFLICT
        expect(error.message).toContain('amount mismatch');
      }
    });

    it('returns 422 for currency mismatch', async () => {
      const service = buildFedaPayService({ status: 'success', currency: 'USD' });
      
      try {
        await service.assertProviderConfirmsCallback(fedaPayTx, 'SUCCESS');
        fail('Should have thrown HttpException');
      } catch (error: any) {
        expect(error.getStatus()).toBe(422); // UNPROCESSABLE_ENTITY
        expect(error.message).toContain('live currency USD is not XOF');
      }
    });

    it('returns 409 for reference mismatch', async () => {
      const service = buildFedaPayService({ status: 'success', reference: 'WRONG-REF' });
      
      try {
        await service.assertProviderConfirmsCallback(fedaPayTx, 'SUCCESS');
        fail('Should have thrown HttpException');
      } catch (error: any) {
        expect(error.getStatus()).toBe(409); // CONFLICT
        expect(error.message).toContain('reference mismatch');
      }
    });

    it('returns 409 for status mismatch (SUCCESS claimed but provider says failed)', async () => {
      const service = buildFedaPayService({ status: 'failed' });
      
      try {
        await service.assertProviderConfirmsCallback(fedaPayTx, 'SUCCESS');
        fail('Should have thrown HttpException');
      } catch (error: any) {
        expect(error.getStatus()).toBe(409); // CONFLICT
        expect(error.message).toContain('provider status is failed');
      }
    });

    it('throws 5xx for transient pending status (FedaPay will retry)', async () => {
      const service = buildFedaPayService({ status: 'pending' });
      
      await expect(
        service.assertProviderConfirmsCallback(fedaPayTx, 'SUCCESS')
      ).rejects.toThrow(/provider status is pending/);
    });
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
