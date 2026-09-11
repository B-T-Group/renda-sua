import type { MobileMoneyCheckoutReturn } from '../navigation/types';

/**
 * Stack reset for deposit-fail “Back to checkout”.
 * Place Order and cart checkout keep their origin; unknown falls back to tabs.
 */
export function checkoutReturnReset(checkoutReturn?: MobileMoneyCheckoutReturn) {
  if (checkoutReturn?.to === 'place-order') {
    return placeOrderReset(checkoutReturn);
  }
  if (checkoutReturn?.to === 'cart-checkout') {
    return {
      index: 2 as const,
      routes: [
        { name: 'ClientMainTabs' as const },
        { name: 'Cart' as const },
        { name: 'CartCheckout' as const },
      ],
    };
  }
  return { index: 0 as const, routes: [{ name: 'ClientMainTabs' as const }] };
}

function placeOrderReset(
  checkoutReturn: Extract<MobileMoneyCheckoutReturn, { to: 'place-order' }>
) {
  return {
    index: 1 as const,
    routes: [
      { name: 'ClientMainTabs' as const },
      {
        name: 'PlaceOrder' as const,
        params: {
          inventoryItemId: checkoutReturn.inventoryItemId,
          ...(checkoutReturn.variantId
            ? { variantId: checkoutReturn.variantId }
            : {}),
        },
      },
    ],
  };
}
