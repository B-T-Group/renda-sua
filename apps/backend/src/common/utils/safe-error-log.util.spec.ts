import { Logger } from '@nestjs/common';
import { ClientError } from 'graphql-request';
import { inspect } from 'util';
import { MobilePaymentsDatabaseService } from '../../mobile-payments/mobile-payments-database.service';
import { maskPhoneDigits, safeErrorMessage } from './safe-error-log.util';

/** A real graphql-request 5.2 ClientError: its message embeds query + variables. */
function hasuraError(): ClientError {
  return new ClientError(
    {
      status: 200,
      errors: [{ message: 'field "x" not found', extensions: { code: 'validation-failed' } } as any],
    } as any,
    {
      query: 'query Q($reference: String!) { mobile_payment_transactions { id } }',
      variables: { reference: 'REF-1', customer_phone: '+237650123456', amount: 5000 },
    } as any
  );
}

describe('safeErrorMessage (L1)', () => {
  it('cuts the graphql request/response JSON and masks phones', () => {
    const err = hasuraError();
    expect(err.message).toContain('650123456'); // the raw message really leaks it
    const safe = safeErrorMessage(err);
    expect(safe).toBe('field "x" not found');
    expect(safe).not.toContain('650123456');
  });

  it('masks phone-like digit runs and redacts tokens in plain errors', () => {
    expect(safeErrorMessage(new Error('payer 237650123456 refused (Bearer abc.def)'))).toBe(
      'payer ***456 refused (Bearer REDACTED)'
    );
    expect(maskPhoneDigits('call +228 90 12 34 56 now')).toBe('call ***456 now');
    expect(maskPhoneDigits('amount 5000 XAF')).toBe('amount 5000 XAF');
  });
});

describe('MobilePaymentsDatabaseService logs Hasura errors without PII (L1)', () => {
  let logged: unknown[][];
  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
  });
  afterEach(() => jest.restoreAllMocks());

  it('getTransactionByReference: rethrows, but the log has no phone and no variables', async () => {
    const hasura = { executeQuery: jest.fn().mockRejectedValue(hasuraError()) };
    const db = new MobilePaymentsDatabaseService(hasura as any);

    await expect(db.getTransactionByReference('REF-1')).rejects.toBeInstanceOf(ClientError);

    const text = logged.map((a) => inspect(a, { depth: 10 })).join('\n');
    expect(text).toContain('Failed to get mobile payment transaction by reference');
    expect(text).not.toContain('650123456');
    expect(text).not.toContain('customer_phone');
  });

  it('createTransaction: the log has no phone', async () => {
    const hasura = { executeQuery: jest.fn().mockRejectedValue(hasuraError()) };
    const db = new MobilePaymentsDatabaseService(hasura as any);

    await expect(
      db.createTransaction({
        reference: 'REF-1',
        amount: 5000,
        currency: 'XAF',
        provider: 'freemopay',
        payment_method: 'mobile_money',
        customer_phone: '+237650123456',
        transaction_type: 'PAYMENT',
      } as any)
    ).rejects.toBeDefined();

    const text = logged.map((a) => inspect(a, { depth: 10 })).join('\n');
    expect(text).not.toContain('650123456');
  });
});
