jest.mock('../business-images/business-images.service', () => ({
  BusinessImagesService: class BusinessImagesService {},
}));
jest.mock('../item-ai-review/item-ai-review.service', () => ({
  ItemAiReviewService: class ItemAiReviewService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));

import { HttpException } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { BusinessItemsAccessService } from './business-items-access.service';
import { BusinessItemsController } from './business-items.controller';
import { BusinessItemsService } from './business-items.service';
import { UpdateBusinessLocationDto } from './dto/update-business-location.dto';

const BUSINESS_ID = 'business-1';
const LOCATION_ID = '8a1f0c5e-1111-4222-8333-444455556666';

describe('PATCH business-items/locations/:locationId whitelist (UAT S-9)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const validate = (body: unknown) =>
    pipe.transform(body, {
      type: 'body',
      metatype: UpdateBusinessLocationDto,
    }) as Promise<UpdateBusinessLocationDto>;

  it('strips business_id, address_id, id and any unknown column before the controller sees them', async () => {
    const dto = await validate({
      name: 'Main store',
      business_id: 'other-business',
      address_id: 'other-address',
      id: 'other-id',
      created_at: '2020-01-01',
      rendasua_item_commission_percentage: 0,
      user_id: 'x',
    });
    expect(dto).toEqual({ name: 'Main store' });
    expect(Object.keys(dto)).not.toEqual(
      expect.arrayContaining(['business_id'])
    );
  });

  it('keeps every field the web and mobile clients send', async () => {
    const body = {
      name: 'Main store',
      phone: '+237600000000',
      order_alert_phone: null,
      mobile_payment_phone_id: '8a1f0c5e-1111-4222-8333-444455556666',
      email: 'a@b.co',
      location_type: 'pickup_point',
      is_active: true,
      is_primary: false,
      auto_withdraw_commissions: true,
      logo_url: '',
      pay_at_confirm: true,
    };
    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each([
    { is_active: 'yes' },
    { pay_at_confirm: 'true' },
    { location_type: 'castle' },
    { mobile_payment_phone_id: 'not-a-uuid' },
    { name: 123 },
  ])('rejects invalid values %p', async (body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(Error);
  });
});

describe('BusinessItemsService.updateBusinessLocation allow-list (UAT S-9)', () => {
  function setup() {
    const hasuraUserService = {
      executeQuery: jest.fn().mockResolvedValue({
        business_locations_by_pk: { id: LOCATION_ID, business_id: BUSINESS_ID },
      }),
    };
    const hasuraSystemService = {
      executeMutation: jest.fn().mockResolvedValue({
        update_business_locations_by_pk: { id: LOCATION_ID },
      }),
    };
    const service = new BusinessItemsService(
      hasuraUserService as any,
      hasuraSystemService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { recompute: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { service, hasuraUserService, hasuraSystemService };
  }

  it('never forwards business_id / address_id / id even if the caller passes them (defence in depth)', async () => {
    const { service, hasuraSystemService } = setup();
    await service.updateBusinessLocation(BUSINESS_ID, LOCATION_ID, {
      name: 'Renamed',
      is_active: false,
      business_id: 'attacker-business',
      address_id: 'attacker-address',
      id: 'attacker-id',
      rendasua_item_commission_percentage: 0,
      pay_at_confirm: true,
    } as any);

    const [, vars] = hasuraSystemService.executeMutation.mock.calls[0];
    expect(vars.id).toBe(LOCATION_ID);
    expect(vars.data).toEqual({
      name: 'Renamed',
      is_active: false,
      pay_at_confirm: true,
    });
  });

  it('still normalises blank alert phone / logo and keeps null clears', async () => {
    const { service, hasuraSystemService } = setup();
    await service.updateBusinessLocation(BUSINESS_ID, LOCATION_ID, {
      order_alert_phone: '   ',
      logo_url: '',
    });
    const [, vars] = hasuraSystemService.executeMutation.mock.calls[0];
    expect(vars.data).toEqual({ order_alert_phone: null, logo_url: null });
  });

  it('refuses a location of another business and writes nothing', async () => {
    const { service, hasuraUserService, hasuraSystemService } = setup();
    hasuraUserService.executeQuery.mockResolvedValue({
      business_locations_by_pk: { id: LOCATION_ID, business_id: 'someone-else' },
    });
    await expect(
      service.updateBusinessLocation(BUSINESS_ID, LOCATION_ID, { name: 'x' })
    ).rejects.toBeInstanceOf(HttpException);
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });
});

describe('BusinessItemsController.patchLocation pay_at_confirm stays owner-only', () => {
  const makeController = (isOwnBusiness: boolean) => {
    const access = new (BusinessItemsAccessService as any)();
    access.resolveAccess = jest.fn().mockResolvedValue({
      targetBusinessId: BUSINESS_ID,
      isPlatformAdmin: !isOwnBusiness,
      isOwnBusiness,
      ownBusinessId: isOwnBusiness ? BUSINESS_ID : 'other',
    });
    const items = {
      updateBusinessLocation: jest.fn().mockResolvedValue({ id: LOCATION_ID }),
    };
    const controller = new (BusinessItemsController as any)(
      {},
      items,
      {},
      access,
      {},
      {},
      {}
    ) as BusinessItemsController;
    return { controller, items };
  };

  it('rejects a non-owner (platform admin) flipping pay_at_confirm', async () => {
    const { controller, items } = makeController(false);
    await expect(
      controller.patchLocation(LOCATION_ID, BUSINESS_ID, {
        pay_at_confirm: true,
      })
    ).rejects.toBeInstanceOf(HttpException);
    expect(items.updateBusinessLocation).not.toHaveBeenCalled();
  });

  it('lets the owner flip pay_at_confirm and passes only the DTO through', async () => {
    const { controller, items } = makeController(true);
    await controller.patchLocation(LOCATION_ID, undefined, {
      pay_at_confirm: true,
    });
    expect(items.updateBusinessLocation).toHaveBeenCalledWith(
      BUSINESS_ID,
      LOCATION_ID,
      { pay_at_confirm: true }
    );
  });
});
