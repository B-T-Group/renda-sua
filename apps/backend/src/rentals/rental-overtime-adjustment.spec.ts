import { HttpException } from '@nestjs/common';
import { RentalsService } from './rentals.service';

describe('RentalsService.adjustEnrolledOvertime', () => {
  const build = (booking: any, affected = 1) => {
    const svc: any = Object.create(RentalsService.prototype);
    svc.fetchBooking = jest.fn().mockResolvedValue(booking);
    svc.hasuraSystemService = {
      executeMutation: jest.fn().mockResolvedValue({ update_rental_bookings: { affected_rows: affected } }),
    };
    svc.logHistory = jest.fn();
    return svc;
  };
  const enrolled = { id: 'b1', status: 'awaiting_return', inspection_policy_version: 1 };

  it('requires a reason and a non-negative amount', async () => {
    const svc = build(enrolled);
    await expect(svc.adjustEnrolledOvertime('b1', 'a', 10, '  ')).rejects.toMatchObject({ status: 400 });
    await expect(svc.adjustEnrolledOvertime('b1', 'a', -1, 'r')).rejects.toMatchObject({ status: 400 });
    expect(svc.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('returns 409 for a legacy booking', async () => {
    const svc = build({ ...enrolled, inspection_policy_version: null });
    await expect(svc.adjustEnrolledOvertime('b1', 'a', 10, 'r')).rejects.toMatchObject({ status: 409 });
  });

  it('returns 409 and writes no history once settlement is claimed', async () => {
    const svc = build(enrolled, 0);
    const error = await svc.adjustEnrolledOvertime('b1', 'a', 10, 'r').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(409);
    expect(svc.logHistory).not.toHaveBeenCalled();
  });

  it('stores the override only while unsettled and writes an audit row', async () => {
    const svc = build(enrolled);
    await expect(svc.adjustEnrolledOvertime('b1', 'admin', 0, ' late fee waived ')).resolves.toEqual({
      overtimeAmount: 0,
      adjusted: true,
    });
    const [query, vars] = svc.hasuraSystemService.executeMutation.mock.calls[0];
    expect(query).toContain('settlement_claimed_at: { _is_null: true }');
    expect(vars).toEqual({ id: 'b1', amount: 0 });
    expect(svc.logHistory).toHaveBeenCalledWith(
      'b1', 'awaiting_return', 'awaiting_return', 'admin', 'system',
      'Support adjusted overtime to 0. late fee waived'
    );
  });
});
