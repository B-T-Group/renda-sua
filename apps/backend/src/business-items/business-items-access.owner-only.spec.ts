import { HttpException } from '@nestjs/common';
import { BusinessItemsAccessService } from './business-items-access.service';

describe('BusinessItemsAccessService.assertOwnBusiness (owner-only fields)', () => {
  const service = Object.create(
    BusinessItemsAccessService.prototype
  ) as BusinessItemsAccessService;
  const ctx = (isOwnBusiness: boolean, isPlatformAdmin = false) => ({
    targetBusinessId: 'b1',
    isPlatformAdmin,
    isOwnBusiness,
    ownBusinessId: isOwnBusiness ? 'b1' : 'b2',
  });

  it('allows the owner', () => {
    expect(() => service.assertOwnBusiness(ctx(true), 'pay_at_confirm')).not.toThrow();
  });

  it('rejects a platform admin editing another business (no admin override in v1)', () => {
    expect(() =>
      service.assertOwnBusiness(ctx(false, true), 'pay_at_confirm')
    ).toThrow(HttpException);
  });
});
