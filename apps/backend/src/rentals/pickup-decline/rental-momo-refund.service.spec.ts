import { RentalMomoRefundService } from './rental-momo-refund.service';

function service(overrides: Record<string, unknown> = {}) {
  const mtn = {
    transfer: jest.fn(async () => ({ status: true, financialTransactionId: 'mtn-ref' })),
    transferDeliveryNotification: jest.fn(async () => ({ statusCode: 'SUCCESSFUL' })),
    ...((overrides.mtn as object) ?? {}),
  };
  const freemopay = {
    withdraw: jest.fn(async () => ({ success: true, reference: 'free-ref' })),
    checkTransactionStatus: jest.fn(async () => ({ status: 'PENDING' })),
    ...((overrides.freemopay as object) ?? {}),
  };
  const fedapay = {
    withdraw: jest.fn(async () => ({ success: true, transactionId: 'feda-ref', ambiguous: false })),
    checkPayoutStatus: jest.fn(async () => ({ status: 'approved' })),
    ...((overrides.fedapay as object) ?? {}),
  };
  const mypvit = {
    getSupportedPaymentMethods: jest.fn(async () => ['mobile_money', 'card', 'bank_transfer']),
    cancelTransaction: jest.fn(async () => true),
  };
  return {
    api: new RentalMomoRefundService(mtn as never, freemopay as never, fedapay as never, mypvit as never),
    mtn,
    freemopay,
    fedapay,
    mypvit,
  };
}

const request = {
  bookingId: '11111111-1111-4111-8111-111111111111',
  amount: 45000,
  currency: 'XAF',
  provider: 'mtn',
  phone: '+237 670 00 67 12',
  transactionId: 'collect-1',
};

describe('RentalMomoRefundService', () => {
  it('sends an MTN disbursement and waits for SUCCESSFUL', async () => {
    const { api, mtn } = service();
    const result = await api.refund(request);
    expect(result.status).toBe('refunded');
    expect(result.providerRef).toBe('mtn-ref');
    expect(mtn.transfer).toHaveBeenCalledWith(expect.objectContaining({ amount: '45000', payee: { partyIdType: 'MSISDN', partyId: '237670006712' } }));
  });

  it('keeps FreemoPay pending until the poll says paid', async () => {
    const { api } = service();
    const result = await api.refund({ ...request, provider: 'freemopay' });
    expect(result.status).toBe('refund_pending');
    expect(result.providerRef).toBe('free-ref');
  });

  it('keeps an ambiguous FedaPay payout pending', async () => {
    const { api } = service({ fedapay: { withdraw: jest.fn(async () => ({ success: false, ambiguous: true, transactionId: 'feda-ref' })), checkPayoutStatus: jest.fn(async () => ({ status: 'pending' })) } });
    const result = await api.refund({ ...request, provider: 'fedapay' });
    expect(result.status).toBe('refund_pending');
    expect(result.providerRef).toBe('feda-ref');
  });

  it('does not cancel a succeeded MyPVit collect', async () => {
    const { api, mypvit } = service();
    const result = await api.refund({ ...request, provider: 'mypvit' });
    expect(result.unsupported).toBe(true);
    expect(result.status).toBe('refund_pending');
    expect(result.providerRef).toBeNull();
    expect(mypvit.cancelTransaction).not.toHaveBeenCalled();
    expect(mypvit.getSupportedPaymentMethods).toHaveBeenCalled();
  });

  it('sends Moov on the channel from the original collect', async () => {
    const { api, fedapay } = service();
    await api.refund({ ...request, provider: 'fedapay', currency: 'XOF', channel: 'moov_tg' });
    expect(fedapay.withdraw).toHaveBeenCalledWith(expect.objectContaining({ channel: 'moov_tg' }));
  });

  it('treats an MTN 4xx as failed and keeps a timeout reference', async () => {
    const rejected = service({
      mtn: {
        transfer: jest.fn(async () => ({ status: false, financialTransactionId: 'mtn-ref', statusCode: '409' })),
        transferDeliveryNotification: jest.fn(),
      },
    });
    const failed = await rejected.api.refund(request);
    expect(failed.status).toBe('failed');
    expect(failed.providerRef).toBe('mtn-ref');
    const timed = service({
      mtn: {
        transfer: jest.fn(async () => ({ status: false, financialTransactionId: 'mtn-ref', statusCode: '504' })),
        transferDeliveryNotification: jest.fn(async () => ({ statusCode: 'PENDING' })),
      },
    });
    const pending = await timed.api.refund(request);
    expect(pending.status).toBe('refund_pending');
    expect(pending.providerRef).toBe('mtn-ref');
  });

  it('stays pending when a poll cannot be reached', async () => {
    const { api } = service({ mtn: { transfer: jest.fn(async () => ({ status: false })), transferDeliveryNotification: jest.fn(async () => { throw new Error('down'); }) } });
    const result = await api.refund(request);
    expect(result.status).toBe('refund_pending');
    expect(result.providerRef).toBeNull();
  });
});
