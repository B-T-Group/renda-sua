import { HttpException, ValidationPipe } from '@nestjs/common';
import { PIPES_METADATA } from '@nestjs/common/constants';
import { AdminRentalBookingsController } from '../admin-rental-bookings.controller';
import { DecideInspectionDisputeDto } from '../dto/rental-inspection.dto';
import { requireInspectionDamageAmount } from './rental-inspection.errors';
import { RentalInspectionService } from './rental-inspection.service';

describe('requireInspectionDamageAmount', () => {
  it('returns null when the outcome is not damage_upheld', () => {
    expect(requireInspectionDamageAmount('no_damage')).toBeNull();
    expect(requireInspectionDamageAmount('damage_rejected', 0)).toBeNull();
  });

  it('accepts a positive amount for damage_upheld', () => {
    expect(requireInspectionDamageAmount('damage_upheld', 25)).toBe(25);
  });

  it.each([undefined, null, 0, -1, Number.NaN])('rejects damage_upheld with amount %p', (amount) => {
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
  });
});

describe('POST admin/rentals/bookings/:id/inspection-decision', () => {
  const pipes = Reflect.getMetadata(PIPES_METADATA, AdminRentalBookingsController) as ValidationPipe[];
  const pipe = pipes.find((item) => item instanceof ValidationPipe);
  const meta = { type: 'body' as const, metatype: DecideInspectionDisputeDto };
  const bookingId = '11111111-1111-4111-8111-111111111111';
  const req = { user: { id: 'admin-1' } } as any;
  let inspections: any;
  let controller: AdminRentalBookingsController;

  beforeEach(() => {
    inspections = Object.create(RentalInspectionService.prototype);
    inspections.one = jest.fn();
    inspections.notice = jest.fn();
    inspections.booking = jest.fn();
    inspections.rentals = { settleEnrolledRental: jest.fn() };
    controller = new AdminRentalBookingsController({} as any, inspections);
  });

  async function decide(body: unknown) {
    const parsed = await pipe!.transform(body, meta);
    return controller.decide(bookingId, parsed, req);
  }

  it('uses the controller ValidationPipe', () => {
    expect(pipe).toBeInstanceOf(ValidationPipe);
  });

  it('decides damage_upheld when the amount is positive', async () => {
    inspections.one.mockResolvedValue({ id: 'dispute-1', decision: 'damage_upheld' });
    inspections.booking.mockResolvedValue({
      client: { user_id: 'client-user' },
      business: { user_id: 'biz-user' },
    });
    await expect(
      decide({ outcome: 'damage_upheld', reason: 'QA decision', damageAmount: 40 })
    ).resolves.toEqual({ decided: true, outcome: 'damage_upheld' });
    expect(inspections.one).toHaveBeenCalledWith(
      'rental_apply_inspection_decision',
      expect.any(String),
      expect.objectContaining({ damage: 40, outcome: 'damage_upheld' })
    );
  });

  it.each([
    ['amount omitted', { outcome: 'damage_upheld', reason: 'QA decision' }],
    ['amount null', { outcome: 'damage_upheld', reason: 'QA decision', damageAmount: null }],
    ['amount zero', { outcome: 'damage_upheld', reason: 'QA decision', damageAmount: 0 }],
    ['amount negative', { outcome: 'damage_upheld', reason: 'QA decision', damageAmount: -5 }],
    ['amount NaN', { outcome: 'damage_upheld', reason: 'QA decision', damageAmount: Number.NaN }],
  ])('returns RENTAL_INSPECTION_DAMAGE_AMOUNT when %s', async (_label, body) => {
    await expect(decide(body)).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({ code: 'RENTAL_INSPECTION_DAMAGE_AMOUNT' }),
    });
    expect(inspections.one).not.toHaveBeenCalled();
  });
});

describe('RentalInspectionService.decide', () => {
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
    svc.one.mockRejectedValue(new Error('Check constraint violation. rental_inspection_damage_amount'));
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
    await expect(svc.decide('booking-1', 'admin-1', 'damage_upheld', 'QA decision', 40)).resolves.toEqual({
      decided: true,
      outcome: 'damage_upheld',
    });
    expect(svc.one).toHaveBeenCalledWith(
      'rental_apply_inspection_decision',
      expect.stringContaining('rental_apply_inspection_decision'),
      expect.objectContaining({ damage: 40, outcome: 'damage_upheld' })
    );
    expect(svc.notice).toHaveBeenCalledWith(expect.anything(), 'decided', 'client-user', 'client');
    expect(svc.rentals.settleEnrolledRental).toHaveBeenCalledWith('booking-1');
  });
});

describe('client inspection reads hide an unsubmitted draft', () => {
  const svc: any = Object.create(RentalInspectionService.prototype);

  it('returns not_ready to the client when no inspection row exists yet', async () => {
    const view = await svc.viewOf('b1', null, 'client');
    expect(view).toMatchObject({ status: 'not_ready', units: [], versionId: null });
  });

  it('keeps an empty draft for the business when no inspection row exists yet', async () => {
    const view = await svc.viewOf('b1', null, 'business');
    expect(view.status).toBe('draft');
    expect(view.units).toEqual([]);
  });

  it('returns no units to the client before the first submit', async () => {
    svc.currentVersion = jest.fn().mockResolvedValue(null);
    svc.versionUnits = jest.fn();
    const view = await svc.viewOf('b1', { id: 'ins', status: 'draft' }, 'client');
    expect(view).toMatchObject({ status: 'not_ready', units: [], versionId: null });
    expect(svc.versionUnits).not.toHaveBeenCalled();
  });

  it('still returns the draft to the business before submit', async () => {
    svc.currentVersion = jest.fn().mockResolvedValue(null);
    svc.versionUnits = jest.fn().mockResolvedValue([
      { unitId: 'u', condition: 'good', wear: 'none', accessories: [], photos: [{ id: 'p', role: 'overview' }] },
    ]);
    const view = await svc.viewOf('b1', { id: 'ins', status: 'draft' }, 'business');
    expect(svc.versionUnits).toHaveBeenCalledWith('b1', 'ins', null);
    expect(view.units).toHaveLength(1);
    expect(view.status).toBe('draft');
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
