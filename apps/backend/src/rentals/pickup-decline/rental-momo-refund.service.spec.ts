import { freemopayRequestUnsent } from '../../mobile-payments/providers/freemopay.service';
import { RentalMomoRefundService } from './rental-momo-refund.service';

function service(overrides: Record<string, unknown> = {}) {
  const mtn = {
    transfer: jest.fn(async () => ({ status: true, financialTransactionId: 'mtn-ref' })),
    transferDeliveryNotification: jest.fn(async () => ({ statusCode: 'SUCCESSFUL' })),
    ...((overrides.mtn as object) ?? {}),
  };
  const freemopay = {
    withdraw: jest.fn(async () => ({ success: true, reference: 'free-ref' })),
    checkTransactionStatus: jest.fn(async () => {
      const error: any = new Error('not found');
      error.status = 404;
      throw error;
    }),
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

describe('freemopayRequestUnsent', () => {
  it('treats a connect failure with no HTTP response as unsent, and any response as ambiguous', () => {
    expect(freemopayRequestUnsent({ code: 'ECONNREFUSED' })).toBe(true);
    expect(freemopayRequestUnsent({ code: 'ENOTFOUND' })).toBe(true);
    expect(freemopayRequestUnsent({ code: 'EAI_AGAIN' })).toBe(true);
    expect(freemopayRequestUnsent({ code: 'ETIMEDOUT' })).toBe(false);
    expect(freemopayRequestUnsent({ code: 'ECONNABORTED' })).toBe(false);
    expect(freemopayRequestUnsent({ response: { status: 503 }, code: 'ERR_BAD_RESPONSE' })).toBe(false);
  });
});

describe('RentalMomoRefundService', () => {
  it('treats an MTN transfer with no HTTP response as unsent', async () => {
    const { api, mtn } = service({
      mtn: { transfer: jest.fn(async () => ({ status: false, financialTransactionId: 'mtn-ref' })) },
    });
    const result = await api.refund({ ...request, referenceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    expect(result.unsent).toBe(true);
    expect(result.connectFailure).toBe(false);
    expect(mtn.transfer).toHaveBeenCalledWith(expect.objectContaining({ referenceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }));
    const refused = service({
      mtn: { transfer: jest.fn(async () => ({ status: false, requestCode: 'ECONNREFUSED' })) },
    });
    expect((await refused.api.refund(request)).connectFailure).toBe(true);
    const timedOut = service({
      mtn: { transfer: jest.fn(async () => ({ status: false, requestCode: 'ECONNABORTED' })) },
    });
    expect((await timedOut.api.refund(request)).connectFailure).toBe(false);
  });

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

  it('leaves the FedaPay reference empty when create is ambiguous and no payout id came back', async () => {
    const { api, fedapay } = service({
      fedapay: {
        withdraw: jest.fn(async () => ({ success: false, ambiguous: true, status: 'pending' })),
        checkPayoutStatus: jest.fn(),
      },
    });
    const result = await api.refund({ ...request, provider: 'fedapay', currency: 'XOF' });
    expect(result.status).toBe('refund_pending');
    expect(result.providerRef).toBeNull();
    expect(result.blankRef).toBe(true);
    expect(fedapay.checkPayoutStatus).not.toHaveBeenCalled();
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

  it('passes strictList to the FedaPay decline payout', async () => {
    const { api, fedapay } = service();
    await api.refund({ ...request, provider: 'fedapay', currency: 'XOF', markedResend: true, trustEmptyList: false });
    expect(fedapay.withdraw).toHaveBeenCalledWith(expect.objectContaining({
      strictList: true,
      markedResend: true,
      trustEmptyList: false,
    }));
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

  it('sends FreemoPay once when the status lookup fails, and does not send from a later probe', async () => {
    const referenceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const { api, freemopay } = service({
      freemopay: {
        withdraw: jest.fn(async () => ({ success: false, ambiguous: true, status: 'UNKNOWN' })),
        checkTransactionStatus: jest.fn(async () => {
          const error: any = new Error('socket hang up');
          throw error;
        }),
      },
    });
    const result = await api.refund({ ...request, provider: 'freemopay', referenceId });
    expect(result.status).toBe('refund_pending');
    expect(result.providerRef).toBe(referenceId);
    expect(freemopay.withdraw).toHaveBeenCalledTimes(1);
    expect(freemopay.withdraw).toHaveBeenCalledWith(expect.objectContaining({ externalId: referenceId }));
    expect(await api.probe('freemopay', referenceId)).toBe('unknown');
    expect(freemopay.withdraw).toHaveBeenCalledTimes(1);
  });

  it('sends one FreemoPay payout when status returns 503 before the withdrawal is accepted', async () => {
    const referenceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const { api, freemopay } = service({
      freemopay: {
        withdraw: jest.fn(async () => ({ success: true, reference: 'FP-1', status: 'CREATED' })),
        checkTransactionStatus: jest.fn(async () => {
          const error: any = new Error('unavailable');
          error.status = 503;
          throw error;
        }),
      },
    });
    const result = await api.refund({ ...request, provider: 'freemopay', referenceId });
    expect(result.status).toBe('refund_pending');
    expect(result.providerRef).toBe('FP-1');
    expect(freemopay.withdraw).toHaveBeenCalledTimes(1);
    expect(await api.probe('freemopay', 'FP-1')).toBe('unknown');
    expect(freemopay.withdraw).toHaveBeenCalledTimes(1);
  });

  it('treats a definite FreemoPay 4xx as failed', async () => {
    const { api, freemopay } = service({
      freemopay: {
        withdraw: jest.fn(async () => ({ success: false, ambiguous: false, status: 'FAILED', errorCode: '400' })),
        checkTransactionStatus: jest.fn(async () => {
          const error: any = new Error('not found');
          error.status = 404;
          throw error;
        }),
      },
    });
    const result = await api.refund({ ...request, provider: 'freemopay', referenceId: 'stable-fp' });
    expect(result.status).toBe('failed');
    expect(freemopay.withdraw).toHaveBeenCalledTimes(1);
  });

  it('reads a known FreemoPay success without sending another withdrawal', async () => {
    const { api, freemopay } = service({
      freemopay: {
        withdraw: jest.fn(async () => ({ success: true, reference: 'free-ref' })),
        checkTransactionStatus: jest.fn(async () => ({ status: 'SUCCESS' })),
      },
    });
    expect(await api.probe('freemopay', 'stable-fp')).toBe('refunded');
    expect(freemopay.withdraw).not.toHaveBeenCalled();
  });

  it('retries a withdrawal that never reached FreemoPay', async () => {
    const refused = service({
      freemopay: {
        withdraw: jest.fn(async () => ({ success: false, unsent: true, ambiguous: false, status: 'FAILED' })),
        checkTransactionStatus: jest.fn(),
      },
    });
    const result = await refused.api.refund({ ...request, provider: 'freemopay' });
    expect(result.unsent).toBe(true);
    expect(result.connectFailure).toBe(true);
    expect(result.providerRef).toBeNull();
    expect(refused.freemopay.checkTransactionStatus).not.toHaveBeenCalled();
  });

  it('treats a FreemoPay status outage and a blank status as unknown, and a 404 as missing', async () => {
    const down = service({
      freemopay: {
        withdraw: jest.fn(),
        checkTransactionStatus: jest.fn(async () => {
          throw new Error('socket hang up');
        }),
      },
    });
    expect(await down.api.probe('freemopay', 'fp-1')).toBe('unknown');
    const missing = service();
    expect(await missing.api.probe('freemopay', 'fp-1')).toBe('missing');
    const blank = service({
      freemopay: {
        withdraw: jest.fn(),
        checkTransactionStatus: jest.fn(async () => ({ status: '' })),
      },
    });
    expect(await blank.api.probe('freemopay', 'fp-1')).toBe('unknown');
    expect(blank.freemopay.withdraw).not.toHaveBeenCalled();
  });

  it('stays pending when a poll cannot be reached', async () => {
    const { api } = service({ mtn: { transfer: jest.fn(async () => ({ status: false })), transferDeliveryNotification: jest.fn(async () => { throw new Error('down'); }) } });
    const result = await api.refund(request);
    expect(result.status).toBe('refund_pending');
    expect(result.providerRef).toBeNull();
  });
});
