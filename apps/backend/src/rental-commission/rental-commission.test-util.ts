import { RentalCommissionService } from './rental-commission.service';

/** Commission service for specs that predate commission: flag off, pure maths stays real. */
export function commissionOffStub(): any {
  const pure = new RentalCommissionService({} as any, {} as any, {} as any, {} as any);
  return {
    quoteInputFromRequest: pure.quoteInputFromRequest.bind(pure),
    quote: jest.fn().mockResolvedValue(null),
    assertAcknowledged: jest.fn(),
    freeze: jest.fn().mockResolvedValue(undefined),
    commissionFor: pure.commissionFor.bind(pure),
    netOfCommission: pure.netOfCommission.bind(pure),
    settle: jest.fn().mockResolvedValue(undefined),
    merchantEarningsForBooking: jest.fn().mockResolvedValue(null),
  };
}
