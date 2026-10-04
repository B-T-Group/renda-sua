type ReadyConfirmOrder = {
  fulfillment_method?: string | null;
  pay_after_merchant_confirm?: boolean | null;
};

type Translate = (key: string, defaultValue: string) => string;

const PAY_AFTER_STORE_BODY =
  'The customer will be notified their order is ready to collect at your store. When they arrive, ask them to tap Complete order in the app. There is no pickup PIN.';

const PIN_STORE_BODY =
  'The customer will be notified their order is ready to collect at your store. When they arrive, ask for their pickup PIN to confirm the handoff and capture payment.';

/** Body for the business "mark ready" confirm dialog. */
export function businessReadyConfirmMessage(
  order: ReadyConfirmOrder,
  t: Translate,
  deliveryDefault: string
): string {
  if (order.fulfillment_method !== 'pickup') {
    return t('business.orders.readyConfirmBody', deliveryDefault);
  }
  if (order.pay_after_merchant_confirm === true) {
    return t('business.orders.readyConfirmBodyStorePayAfter', PAY_AFTER_STORE_BODY);
  }
  return t('business.orders.readyConfirmBodyStore', PIN_STORE_BODY);
}
