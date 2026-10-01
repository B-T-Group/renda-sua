import { isCookedFoodOrderSnapshot } from './cooked-food-flag.util';
import {
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

describe('resolvePayAfterConfirm (cooked reason only)', () => {
  it('cooked MoMo pickup and delivery are pay-after', () => {
    expect(resolvePayAfterConfirmReason(base)).toBe('cooked_food');
    expect(
      resolvePayAfterConfirm({ ...base, fulfillment: 'pickup' })
    ).toBe(true);
  });

  it('non-cooked goods are never pay-after in phase 1', () => {
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
