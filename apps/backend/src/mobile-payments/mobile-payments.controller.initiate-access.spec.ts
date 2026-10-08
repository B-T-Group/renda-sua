/**
 * QA #511 follow-up. S1: a PAYMENT (top-up) / untyped initiate into another user's
 * account must 404 like GIVE_CHANGE. L1: malformed accountId / transactionType must
 * be a 400 from the DTO, and unexpected errors must not echo raw Hasura messages.
 */
import {
  ArgumentMetadata,
  BadRequestException,
  HttpException,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import {
  InitiatePaymentDto,
  MobilePaymentsController,
} from './mobile-payments.controller';

const OWN = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('MobilePaymentsController initiate: account ownership (S1)', () => {
  const ctx = {} as never;
  let accountsService: { getAccountBalance: jest.Mock };
  let transactionAccessService: { canView: jest.Mock };
  let controller: MobilePaymentsController;

  beforeEach(() => {
    accountsService = {
      getAccountBalance: jest.fn().mockRejectedValue(
        new Error('invalid input syntax for type uuid: "abc" query AccountBalance { … }')
      ),
    };
    transactionAccessService = {
      canView: jest.fn(async ({ account_id }: { account_id: string }) => account_id === OWN),
    };
    controller = new MobilePaymentsController(
      {} as never,
      {} as never,
      accountsService as never,
      {} as never,
      { getUser: jest.fn().mockResolvedValue({ id: 'user-1' }) } as never,
      {} as never,
      {} as never,
      {} as never,
      transactionAccessService as never
    );
  });

  async function httpError(run: () => Promise<unknown>): Promise<HttpException> {
    try {
      await run();
    } catch (caught) {
      expect(caught).toBeInstanceOf(HttpException);
      return caught as HttpException;
    }
    throw new Error('expected HttpException');
  }

  const topUp = (accountId: string, transactionType?: 'PAYMENT') =>
    ({
      amount: 500,
      currency: 'XAF',
      description: 'Account Top Up',
      customerPhone: '+237670000000',
      accountId,
      ...(transactionType ? { transactionType } : {}),
    }) as InitiatePaymentDto;

  it.each([['PAYMENT' as const], [undefined]])(
    'cross-user top-up (transactionType=%s) is a 404 before any balance read',
    async (type) => {
      const error = await httpError(() => controller.initiatePayment(ctx, topUp(OTHER, type)));

      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({ error: 'ACCOUNT_NOT_FOUND' })
      );
      expect(transactionAccessService.canView).toHaveBeenCalledWith(
        { account_id: OTHER },
        'user-1'
      );
      expect(accountsService.getAccountBalance).not.toHaveBeenCalled();
    }
  );

  it('own-account top-up passes the gate (balance is read)', async () => {
    await httpError(() => controller.initiatePayment(ctx, topUp(OWN, 'PAYMENT')));
    expect(accountsService.getAccountBalance).toHaveBeenCalledWith(OWN);
  });

  it('unexpected failures are a generic 500 without the raw DB error (L1)', async () => {
    const error = await httpError(() => controller.initiatePayment(ctx, topUp(OWN, 'PAYMENT')));

    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(error.getResponse()).toEqual({
      success: false,
      message: 'Failed to initiate payment',
      error: 'PAYMENT_INITIATION_FAILED',
    });
    expect(JSON.stringify(error.getResponse())).not.toMatch(/uuid|query|syntax/i);
  });
});

describe('InitiatePaymentDto validation (L1)', () => {
  const pipe = new ValidationPipe({ transform: true });
  const meta: ArgumentMetadata = { type: 'body', metatype: InitiatePaymentDto };
  const base = { amount: 500, currency: 'XAF', description: 'x', transactionType: 'PAYMENT' };

  it.each([
    ['a non-uuid string', { accountId: 'abc' }],
    ['an array', { accountId: [OWN] }],
    ['an object', { accountId: { id: OWN } }],
    ['an unknown transaction type', { transactionType: 'REFUND' }],
    ['a non-numeric amount', { amount: 'lots' }],
    ['a missing currency', { currency: undefined }],
  ])('rejects %s with a 400', async (_label, patch) => {
    await expect(pipe.transform({ ...base, ...patch }, meta)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('accepts the bodies the web and mobile apps send (extra fields kept)', async () => {
    const body = {
      ...base,
      accountId: OWN,
      customerPhone: '+237670000000',
      paymentMethod: 'mobile_money',
      itemCountry: 'CM',
    };
    const out = await pipe.transform(body, meta);
    expect(out).toBeInstanceOf(InitiatePaymentDto);
    expect(out).toEqual(expect.objectContaining({ accountId: OWN, amount: 500, itemCountry: 'CM' }));
  });

  it('accepts a GIVE_CHANGE body without description', async () => {
    const { description: _d, ...noDescription } = base;
    await expect(
      pipe.transform({ ...noDescription, transactionType: 'GIVE_CHANGE', accountId: OWN }, meta)
    ).resolves.toBeInstanceOf(InitiatePaymentDto);
  });
});
