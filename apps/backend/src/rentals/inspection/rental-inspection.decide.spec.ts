import { BadRequestException, HttpException, ValidationPipe } from '@nestjs/common';
import { DecideInspectionDisputeDto } from '../dto/rental-inspection.dto';
import { requireInspectionDamageAmount } from './rental-inspection.errors';
import { RentalInspectionService } from './rental-inspection.service';

describe('requireInspectionDamageAmount (NODE-NESTJS-4N)', () => {
  it('returns null when the outcome is not damage_upheld', () => {
    expect(requireInspectionDamageAmount('no_damage')).toBeNull();
    expect(requireInspectionDamageAmount('damage_rejected', 0)).toBeNull();
  });

  it('accepts a positive amount for damage_upheld', () => {
    expect(requireInspectionDamageAmount('damage_upheld', 25)).toBe(25);
  });

  it.each([undefined, null, 0, -1, Number.NaN])(
    'rejects damage_upheld with amount %p',
    (amount) => {
      try {
        requireInspectionDamageAmount('damage_upheld', amount);
        throw new Error('expected HTTP 400');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toEqual(
          expect.objectContaining({ code: 'RENTAL_INSPECTION_DAMAGE_AMOUNT' })
        );
      }
    }
  );
});

describe('DecideInspectionDisputeDto (NODE-NESTJS-4N)', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const meta = { type: 'body' as const, metatype: DecideInspectionDisputeDto };
  const run = (body: unknown) => pipe.transform(body, meta);

  it('accepts damage_upheld with a positive amount', async () => {
    await expect(
      run({ outcome: 'damage_upheld', reason: 'QA decision', damageAmount: 40 })
    ).resolves.toMatchObject({ outcome: 'damage_upheld', damageAmount: 40 });
  });

  it('accepts no_damage without an amount', async () => {
    await expect(run({ outcome: 'no_damage', reason: 'QA decision' })).resolves.toMatchObject({
      outcome: 'no_damage',
    });
  });

  it.each([
    ['amount omitted', { outcome: 'damage_upheld', reason: 'QA decision' }],
    ['amount null', { outcome: 'damage_upheld', reason: 'QA decision', damageAmount: null }],
    ['amount zero', { outcome: 'damage_upheld', reason: 'QA decision', damageAmount: 0 }],
    ['amount negative', { outcome: 'damage_upheld', reason: 'QA decision', damageAmount: -5 }],
  ])('rejects damage_upheld when %s', async (_label, body) => {
    const error = await run(body).catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
  });
});

describe('RentalInspectionService.decide (NODE-NESTJS-4N)', () => {
  const svc: any = Object.create(RentalInspectionService.prototype);

  beforeEach(() => {
    svc.hasura = { executeMutation: jest.fn(), executeQuery: jest.fn() };
    svc.rentals = { settleEnrolledRental: jest.fn() };
    svc.notice = jest.fn();
    svc.booking = jest.fn().mockResolvedValue({
      client: { user_id: 'client-user' },
      business: { user_id: 'biz-user' },
    });
    svc.one = jest.fn();
  });

  it('returns 400 and does not call Hasura when damage_upheld has no amount', async () => {
    await expect(svc.decide('booking-1', 'admin-1', 'damage_upheld', 'QA decision')).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({ code: 'RENTAL_INSPECTION_DAMAGE_AMOUNT' }),
    });
    expect(svc.one).not.toHaveBeenCalled();
  });

  it('remaps a leftover Hasura damage_amount check violation to HTTP 400', async () => {
    svc.one.mockRejectedValue(
      new Error('Check constraint violation. rental_inspection_damage_amount')
    );
    await expect(
      svc.decide('booking-1', 'admin-1', 'damage_upheld', 'QA decision', 40)
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({ code: 'RENTAL_INSPECTION_DAMAGE_AMOUNT' }),
    });
    expect(svc.rentals.settleEnrolledRental).not.toHaveBeenCalled();
  });

  it('applies a valid damage_upheld decision and settles', async () => {
    svc.one.mockResolvedValue({ id: 'dispute-1', decision: 'damage_upheld' });
    await expect(
      svc.decide('booking-1', 'admin-1', 'damage_upheld', 'QA decision', 40)
    ).resolves.toEqual({ decided: true, outcome: 'damage_upheld' });
    expect(svc.one).toHaveBeenCalledWith(
      'rental_apply_inspection_decision',
      expect.stringContaining('rental_apply_inspection_decision'),
      expect.objectContaining({ damage: 40, outcome: 'damage_upheld' })
    );
    expect(svc.rentals.settleEnrolledRental).toHaveBeenCalledWith('booking-1');
  });
});

describe('HttpException remap helper', () => {
  const svc: any = Object.create(RentalInspectionService.prototype);

  it('maps a missing open review to HTTP 409', () => {
    const error = svc.decisionError({
      message: 'Check constraint violation. rental_inspection_decision_missing',
    });
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(409);
  });
});
