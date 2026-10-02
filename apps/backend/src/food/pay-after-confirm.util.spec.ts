import { isCookedFoodOrderSnapshot } from './cooked-food-flag.util';
import {
  anyLocationPayAtConfirm,
  resolvePayAfterConfirm,
  resolvePayAfterConfirmReason,
} from './pay-after-confirm.util';

const cooked = { is_cooked_food: true };
const goods = { is_cooked_food: false };

const base = {
  lines: [cooked],
  fulfillment: 'delivery',
  rail: 'mobile_money',
  canPayWithWallet: false,
  isZeroOrder: false,
};

describe('resolvePayAfterConfirm (cooked reason)', () => {
  it('cooked MoMo pickup and delivery are pay-after', () => {
    expect(resolvePayAfterConfirmReason(base)).toBe('cooked_food');
    expect(
      resolvePayAfterConfirm({ ...base, fulfillment: 'pickup' })
    ).toBe(true);
  });

  it('non-cooked goods are not pay-after without the location flag', () => {
    expect(resolvePayAfterConfirm({ ...base, lines: [goods] })).toBe(false);
  });

  it('mixed cart (not every line cooked) is not pay-after', () => {
    expect(resolvePayAfterConfirm({ ...base, lines: [cooked, goods] })).toBe(
      false
    );
  });

  it('category wins over an explicit is_cooked_food=false', () => {
    const line = {
      is_cooked_food: false,
      item_sub_category: { item_category: { name: 'Restaurant & Cooked Food' } },
    };
    expect(resolvePayAfterConfirm({ ...base, lines: [line] })).toBe(true);
  });

  it('empty cart is false', () => {
    expect(resolvePayAfterConfirm({ ...base, lines: [] })).toBe(false);
  });

  it.each(['stripe', 'wallet', null, undefined])(
    'rail %s is not pay-after (stripe / diaspora card payers)',
    (rail) => {
      expect(resolvePayAfterConfirm({ ...base, rail: rail as any })).toBe(false);
    }
  );

  it('wallet-covered clients pay immediately', () => {
    expect(resolvePayAfterConfirm({ ...base, canPayWithWallet: true })).toBe(
      false
    );
  });

  it('zero / negative orders are not pay-after', () => {
    expect(resolvePayAfterConfirm({ ...base, isZeroOrder: true })).toBe(false);
  });

  it.each(['shipping', null, undefined, 'rental'])(
    'fulfilment %s never qualifies',
    (fulfillment) => {
      expect(
        resolvePayAfterConfirm({ ...base, fulfillment: fulfillment as any })
      ).toBe(false);
    }
  );
});

describe('isCookedFoodOrderSnapshot', () => {
  it('pickup snapshot wins', () => {
    expect(
      isCookedFoodOrderSnapshot({
        is_cooked_food_pickup: true,
        order_items: [{ is_cooked_food: false }],
      })
    ).toBe(true);
  });

  it('uses line snapshots when present', () => {
    expect(
      isCookedFoodOrderSnapshot({
        pay_after_merchant_confirm: true,
        order_items: [{ is_cooked_food: true }, { is_cooked_food: true }],
      })
    ).toBe(true);
    expect(
      isCookedFoodOrderSnapshot({
        pay_after_merchant_confirm: true,
        order_items: [{ is_cooked_food: true }, { is_cooked_food: false }],
      })
    ).toBe(false);
  });

  it('falls back to the pay-after invariant when lines are not loaded', () => {
    expect(isCookedFoodOrderSnapshot({ pay_after_merchant_confirm: true })).toBe(
      true
    );
    expect(isCookedFoodOrderSnapshot({ pay_after_merchant_confirm: false })).toBe(
      false
    );
    expect(
      isCookedFoodOrderSnapshot({
        pay_after_merchant_confirm: true,
        order_items: [],
      })
    ).toBe(true);
  });
});

describe('resolvePayAfterConfirm (location_flag reason)', () => {
  const flagged = { ...base, lines: [goods], locationPayAtConfirm: true };

  it('flagged location makes non-cooked pickup and delivery pay-after', () => {
    expect(resolvePayAfterConfirmReason(flagged)).toBe('location_flag');
    expect(
      resolvePayAfterConfirmReason({ ...flagged, fulfillment: 'pickup' })
    ).toBe('location_flag');
  });

  it('mixed cooked + non-cooked lines in a flagged cart are pay-after', () => {
    expect(
      resolvePayAfterConfirmReason({ ...flagged, lines: [cooked, goods] })
    ).toBe('location_flag');
  });

  it('cooked reason wins when every line is cooked', () => {
    expect(
      resolvePayAfterConfirmReason({ ...flagged, lines: [cooked] })
    ).toBe('cooked_food');
  });

  it('is not pay-after when the flag/kill switch is off', () => {
    expect(
      resolvePayAfterConfirm({ ...flagged, locationPayAtConfirm: false })
    ).toBe(false);
    expect(
      resolvePayAfterConfirm({ ...flagged, locationPayAtConfirm: undefined })
    ).toBe(false);
  });

  it('wallet-covered clients still pay immediately', () => {
    expect(resolvePayAfterConfirm({ ...flagged, canPayWithWallet: true })).toBe(
      false
    );
  });

  it('zero orders, stripe rail and diaspora payers are a no-op', () => {
    expect(resolvePayAfterConfirm({ ...flagged, isZeroOrder: true })).toBe(false);
    expect(resolvePayAfterConfirm({ ...flagged, rail: 'stripe' })).toBe(false);
    expect(resolvePayAfterConfirm({ ...flagged, isDiaspora: true })).toBe(false);
  });

  it.each(['shipping', null, undefined, 'rental'])(
    'fulfilment %s never qualifies even when flagged',
    (fulfillment) => {
      expect(
        resolvePayAfterConfirm({ ...flagged, fulfillment: fulfillment as any })
      ).toBe(false);
    }
  );
});

describe('anyLocationPayAtConfirm', () => {
  it('is true when ANY line location is flagged', () => {
    expect(
      anyLocationPayAtConfirm([
        { business_location: { pay_at_confirm: false } },
        { business_location: { pay_at_confirm: true } },
      ])
    ).toBe(true);
  });

  it('is false for unflagged, null or missing locations', () => {
    expect(
      anyLocationPayAtConfirm([
        { business_location: { pay_at_confirm: false } },
        { business_location: null },
        {},
      ])
    ).toBe(false);
    expect(anyLocationPayAtConfirm([])).toBe(false);
  });
});
