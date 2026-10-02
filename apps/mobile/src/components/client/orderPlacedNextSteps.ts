import type { OrderPlacedSuccessParams } from '../../navigation/types';

export type OrderNextStep = {
  id: string;
  key: string;
  defaultText: string;
  values?: Record<string, string>;
};

export type OrderNextStepsContent = {
  titleKey: string;
  titleDefault: string;
  tone: 'action' | 'success' | 'info';
  steps: OrderNextStep[];
};

type NextStepsInput = OrderPlacedSuccessParams & {
  depositConfirmed?: boolean;
  remainingAmountLabel?: string;
  isStripeRail: boolean;
};

type FulfillmentPath = 'pickup' | 'delivery' | 'shipping';

const STEPS = 'client.placeOrder.successScreen.steps';

export function resolveOrderNextSteps(input: NextStepsInput): OrderNextStepsContent | null {
  if (input.depositConfirmed) return depositSteps(input);
  if (input.cookedFoodPayAfterConfirm) {
    return input.payAfterCopyVariant === 'store' ? storePayAfterSteps(input) : foodSteps(input);
  }
  if (input.paymentCompleted) return paidSteps(input);
  if (input.cardAuthorized) return cardSteps(input);
  if (input.isStripeRail) return stripeSteps(input);
  if (input.paymentTiming === 'pay_now') return payNowSteps(input);
  if (input.paymentTiming === 'pay_at_delivery') return payAtDeliverySteps();
  if (input.paymentTiming === 'pay_at_pickup') return payAtPickupSteps();
  return null;
}

function depositSteps(input: NextStepsInput): OrderNextStepsContent {
  const where = fulfillmentPath(input);
  return {
    titleKey: 'deposit.paidTitle',
    titleDefault: 'Deposit confirmed',
    tone: 'success',
    steps: [
      depositPrep(),
      ...(where === 'shipping' ? [] : [readyNotice()]),
      remainderStep(where, input.remainingAmountLabel),
      doneStep(where),
    ],
  };
}

function foodSteps(input: NextStepsInput): OrderNextStepsContent {
  const pickup = fulfillmentPath(input) === 'pickup';
  return {
    titleKey: `${STEPS}.foodTitle`,
    titleDefault: 'What happens next',
    tone: 'info',
    steps: pickup ? foodPickupSteps() : foodDeliverySteps(),
  };
}

function paidSteps(input: NextStepsInput): OrderNextStepsContent {
  return {
    titleKey: 'client.placeOrder.successScreen.paidTitle',
    titleDefault: 'Order confirmed and paid',
    tone: 'success',
    steps: [storePrepares(), ...afterPaidFulfillment(fulfillmentPath(input))],
  };
}

function cardSteps(input: NextStepsInput): OrderNextStepsContent {
  return {
    titleKey: 'client.placeOrder.successScreen.cardAuthorizedTitle',
    titleDefault: 'Card authorized',
    tone: 'info',
    steps: cardPathSteps(fulfillmentPath(input)),
  };
}

function stripeSteps(input: NextStepsInput): OrderNextStepsContent {
  return {
    titleKey: 'client.placeOrder.successScreen.cardPaymentTitle',
    titleDefault: 'Card payment',
    tone: 'info',
    steps: [finishCard(), storePrepares(), ...afterPaidFulfillment(fulfillmentPath(input))],
  };
}

function payNowSteps(input: NextStepsInput): OrderNextStepsContent {
  return {
    titleKey: 'client.placeOrder.successScreen.payNowTitle',
    titleDefault: 'Payment confirmation required',
    tone: 'action',
    steps: [approveNow(), afterPayNowPrep(), ...afterPaidFulfillment(fulfillmentPath(input))],
  };
}

function payAtPickupSteps(): OrderNextStepsContent {
  return {
    titleKey: `${STEPS}.pickupTitle`,
    titleDefault: 'What happens next',
    tone: 'info',
    steps: [storePrepares(), readyNotice(), pickupPayNow(), pickupDone()],
  };
}

function payAtDeliverySteps(): OrderNextStepsContent {
  return {
    titleKey: `${STEPS}.deliveryTitle`,
    titleDefault: 'What happens next',
    tone: 'info',
    steps: [storePrepares(), courierRequest(), deliveryDone()],
  };
}

function foodPickupSteps(): OrderNextStep[] {
  return [foodConfirm(), foodPay(), foodPrep(), foodReadyPickup(), foodComplete()];
}

function foodDeliverySteps(): OrderNextStep[] {
  return [foodConfirm(), foodPay(), foodPrep(), foodReadyDelivery(), foodOnTheWay()];
}

function cardPathSteps(where: FulfillmentPath): OrderNextStep[] {
  if (where === 'pickup') return [storePrepares(), readyNotice(), cardChargePickup(), collectPaid()];
  if (where === 'shipping') return [storePrepares(), cardChargeShip(), trackOrder()];
  return [storePrepares(), cardChargeDelivery(), courierDelivers()];
}

function remainderStep(where: FulfillmentPath, amount?: string): OrderNextStep {
  const values = { amount: amount ?? '' };
  if (where === 'pickup') {
    return step(
      'remainder',
      `${STEPS}.pickupRemainder`,
      'At the store, tap Pay now to send a request for the remaining {{amount}} to your phone.',
      values
    );
  }
  if (where === 'shipping') {
    return step(
      'remainder',
      `${STEPS}.shipRemainder`,
      'Before it ships, approve a request for the remaining {{amount}} on your phone.',
      values
    );
  }
  return step(
    'remainder',
    `${STEPS}.deliveryRemainder`,
    'When the courier arrives, they send a request for the remaining {{amount}} to your phone.',
    values
  );
}

function doneStep(where: FulfillmentPath): OrderNextStep {
  if (where === 'pickup') return pickupDone();
  if (where === 'shipping') return shipAfterPay();
  return deliveryDone();
}

function afterPaidFulfillment(where: FulfillmentPath): OrderNextStep[] {
  if (where === 'pickup') return [readyNotice(), collectPaid()];
  if (where === 'shipping') return [ships(), trackOrder()];
  return [courierDelivers()];
}

function fulfillmentPath(input: NextStepsInput): FulfillmentPath {
  if (input.fulfillment === 'pickup' || input.paymentTiming === 'pay_at_pickup') return 'pickup';
  if (input.fulfillment === 'shipping') return 'shipping';
  return 'delivery';
}

function step(
  id: string,
  key: string,
  defaultText: string,
  values?: Record<string, string>
): OrderNextStep {
  return { id, key, defaultText, values };
}

function depositPrep(): OrderNextStep {
  return step(
    'prep',
    `${STEPS}.depositPrep`,
    'Your deposit is confirmed. The store will prepare your order.'
  );
}

function storePrepares(): OrderNextStep {
  return step('prep', `${STEPS}.storePrepares`, 'The store prepares your order.');
}

function readyNotice(): OrderNextStep {
  return step('ready', `${STEPS}.readyNotice`, 'You will be notified when it is ready.');
}

function pickupPayNow(): OrderNextStep {
  return step(
    'pay',
    `${STEPS}.pickupPayNow`,
    'At the store, tap Pay now to send a payment request to your mobile number.'
  );
}

function pickupDone(): OrderNextStep {
  return step(
    'done',
    `${STEPS}.pickupDone`,
    'Once you approve it, the order is complete and you can pick it up.'
  );
}

function courierRequest(): OrderNextStep {
  return step(
    'pay',
    `${STEPS}.courierRequest`,
    'When the courier arrives, they send a payment request to your phone.'
  );
}

function deliveryDone(): OrderNextStep {
  return step(
    'done',
    `${STEPS}.deliveryDone`,
    'Approve it on your phone, then receive your order.'
  );
}

function storePayAfterSteps(input: NextStepsInput): OrderNextStepsContent {
  const pickup = fulfillmentPath(input) === 'pickup';
  return {
    titleKey: `${STEPS}.foodTitle`,
    titleDefault: 'What happens next',
    tone: 'info',
    steps: [
      step('confirm', `${STEPS}.storeConfirm`, 'The store confirms your order.'),
      step(
        'pay',
        `${STEPS}.storePay`,
        'You then receive a Mobile Money payment request. Approve it within about 45 minutes or the order is cancelled automatically.'
      ),
      step('prep', `${STEPS}.storePrep`, 'Once it is paid, the store prepares your order.'),
      pickup ? foodReadyPickup() : foodReadyDelivery(),
      pickup ? foodComplete() : foodOnTheWay(),
    ],
  };
}

function foodConfirm(): OrderNextStep {
  return step(
    'confirm',
    `${STEPS}.foodConfirm`,
    'The kitchen confirms your order.'
  );
}

function foodPay(): OrderNextStep {
  return step(
    'pay',
    `${STEPS}.foodPay`,
    'You then receive a Mobile Money payment request. Approve it on your phone.'
  );
}

function foodPrep(): OrderNextStep {
  return step(
    'prep',
    `${STEPS}.foodPrep`,
    'Once it is paid, the kitchen starts preparing your order.'
  );
}

function foodReadyPickup(): OrderNextStep {
  return step(
    'ready',
    `${STEPS}.foodReadyPickup`,
    'When it is ready, you are notified and can come pick it up.'
  );
}

function foodComplete(): OrderNextStep {
  return step(
    'done',
    `${STEPS}.foodComplete`,
    'Tap Complete order in the app, then collect it.'
  );
}

function foodReadyDelivery(): OrderNextStep {
  return step(
    'ready',
    `${STEPS}.foodReadyDelivery`,
    'When it is ready, a courier picks it up and delivers it.'
  );
}

function foodOnTheWay(): OrderNextStep {
  return step(
    'done',
    `${STEPS}.foodOnTheWay`,
    'You are notified when it is on the way. There is no extra payment at the door.'
  );
}

function collectPaid(): OrderNextStep {
  return step(
    'collect',
    `${STEPS}.collectPaid`,
    'Come pick it up. It is already paid.'
  );
}

function courierDelivers(): OrderNextStep {
  return step(
    'deliver',
    `${STEPS}.courierDelivers`,
    'A courier delivers it. You are notified when it is on the way, with no extra payment.'
  );
}

function ships(): OrderNextStep {
  return step('ship', `${STEPS}.ships`, 'We ship it to your address.');
}

function trackOrder(): OrderNextStep {
  return step('track', `${STEPS}.trackOrder`, 'Track it in My orders.');
}

function shipAfterPay(): OrderNextStep {
  return step(
    'done',
    `${STEPS}.shipAfterPay`,
    'Once that payment is approved, we ship it. Track it in My orders.'
  );
}

function approveNow(): OrderNextStep {
  return step(
    'pay',
    `${STEPS}.approveNow`,
    'Approve the payment request already sent to your phone.'
  );
}

function afterPayNowPrep(): OrderNextStep {
  return step(
    'prep',
    `${STEPS}.afterPayNow`,
    'Once payment is confirmed, the store starts preparing your order.'
  );
}

function finishCard(): OrderNextStep {
  return step(
    'pay',
    `${STEPS}.finishCard`,
    'Finish the card payment from your order details.'
  );
}

function cardChargePickup(): OrderNextStep {
  return step(
    'charge',
    `${STEPS}.cardChargePickup`,
    'Your card is charged when you collect it.'
  );
}

function cardChargeDelivery(): OrderNextStep {
  return step(
    'charge',
    `${STEPS}.cardChargeDelivery`,
    'Your card is charged when the courier picks it up from the store.'
  );
}

function cardChargeShip(): OrderNextStep {
  return step(
    'charge',
    `${STEPS}.cardChargeShip`,
    'Your card is charged when the order ships.'
  );
}
