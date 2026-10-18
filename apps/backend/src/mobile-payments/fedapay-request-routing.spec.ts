import { MobilePaymentsService } from './mobile-payments.service';

/**
 * Phone prefix selects the Togo operator, and a give-change poll must hit
 * the payout API. A wrong channel or a collection lookup pays the wrong wallet.
 */
function buildService() {
  const fedapayService = {
    getCallbackUrl: jest.fn().mockReturnValue('https://cb.example/fedapay'),
    checkTransactionStatus: jest.fn(),
    checkPayoutStatus: jest.fn(),
  };
  const service = new MobilePaymentsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    fedapayService as never,
    {} as never
  );
  return { service, fedapayService };
}

function providerRequest(
  service: MobilePaymentsService,
  phone: string,
  transactionType: 'PAYMENT' | 'GIVE_CHANGE'
) {
  return (service as unknown as {
    convertToProviderRequest: (
      request: Record<string, unknown>,
      provider: string,
      reference: string,
      region: string
    ) => Record<string, unknown>;
  }).convertToProviderRequest(
    {
      amount: 2500,
      currency: 'XOF',
      description: 'Order',
      customerPhone: phone,
      transactionType,
    },
    'fedapay',
    'ref-1',
    'TG'
  );
}

describe('FedaPay provider request routing', () => {
  it('sends a Moov number as moov_tg and a Mixx number as togocel', () => {
    const { service, fedapayService } = buildService();

    expect(providerRequest(service, '+22878123456', 'PAYMENT')).toEqual({
      payer: '22878123456',
      amount: 2500,
      externalId: 'ref-1',
      description: 'Order',
      callback: 'https://cb.example/fedapay',
      channel: 'moov_tg',
    });
    expect(providerRequest(service, '+22899123456', 'PAYMENT')).toMatchObject({
      payer: '22899123456',
      channel: 'moov_tg',
    });
    expect(providerRequest(service, '+22890123456', 'PAYMENT')).toMatchObject({
      payer: '22890123456',
      channel: 'togocel',
    });
    expect(providerRequest(service, '+22870123456', 'PAYMENT')).toMatchObject({
      payer: '22870123456',
      channel: 'togocel',
    });
    expect(fedapayService.getCallbackUrl).toHaveBeenCalled();
  });

  it('builds a payout request with payee, not a collection payer', () => {
    const { service } = buildService();

    expect(providerRequest(service, '+22890123456', 'GIVE_CHANGE')).toEqual({
      payee: '22890123456',
      amount: 2500,
      externalId: 'ref-1',
      description: 'Order',
      callback: 'https://cb.example/fedapay',
      channel: 'togocel',
    });
    expect(providerRequest(service, '+22878123456', 'GIVE_CHANGE')).toMatchObject({
      payee: '22878123456',
      channel: 'moov_tg',
    });
  });
});

describe('FedaPay live status routing', () => {
  it.each([
    ['approved', 'success'],
    ['transferred', 'success'],
    ['declined', 'failed'],
    ['expired', 'failed'],
    ['canceled', 'cancelled'],
    ['pending', 'pending'],
    ['started', 'pending'],
  ])('maps collection status %s to %s', async (raw, mapped) => {
    const { service, fedapayService } = buildService();
    fedapayService.checkTransactionStatus.mockResolvedValue({
      transactionId: 'tx-1',
      status: raw,
      amount: 1000,
      currency: 'XOF',
      merchantRef: 'REF-1',
    });

    const status = await service.checkTransactionStatus(
      'tx-1',
      'fedapay',
      '+22890123456',
      false
    );

    expect(fedapayService.checkTransactionStatus).toHaveBeenCalledWith('tx-1');
    expect(fedapayService.checkPayoutStatus).not.toHaveBeenCalled();
    expect(status).toMatchObject({
      status: mapped,
      amount: 1000,
      currency: 'XOF',
      reference: 'REF-1',
      provider: 'fedapay',
    });
  });

  it('polls a give-change id on the payout API', async () => {
    const { service, fedapayService } = buildService();
    fedapayService.checkPayoutStatus.mockResolvedValue({
      transactionId: 'payout-9',
      status: 'declined',
      amount: 5000,
      currency: 'XOF',
      merchantRef: 'P123',
    });

    const status = await service.checkTransactionStatus(
      'payout-9',
      'fedapay',
      '+22890123456',
      true
    );

    expect(fedapayService.checkPayoutStatus).toHaveBeenCalledWith('payout-9');
    expect(fedapayService.checkTransactionStatus).not.toHaveBeenCalled();
    expect(status.status).toBe('failed');
    expect(status.reference).toBe('P123');
  });

  it('fails closed when the live currency or amount is missing', async () => {
    const { service, fedapayService } = buildService();
    fedapayService.checkTransactionStatus.mockResolvedValue({
      transactionId: 'tx-1',
      status: 'approved',
      reference: 'REF-1',
    });

    const status = await service.checkTransactionStatus('tx-1', 'fedapay');

    expect(status.currency).toBe('');
    expect(status.amount).toBe(0);
    expect(status.status).toBe('success');
  });
});
