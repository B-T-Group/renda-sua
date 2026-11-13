export function setupIntentKey(bookingId: string): string {
  return `setup_rental_${bookingId}`;
}

export function setupCheckoutKey(bookingId: string): string {
  return `setup_checkout_rental_${bookingId}`;
}

export function contractKey(bookingId: string, attempt: number): string {
  return `pi_rental_contract_${bookingId}_a${attempt}`;
}

export function depositKey(bookingId: string, attempt: number): string {
  return `pi_rental_deposit_${bookingId}_a${attempt}`;
}

export function contractRefundKey(bookingId: string, attempt: number): string {
  return `refund_rental_contract_${bookingId}_a${attempt}`;
}

export function renewalKey(bookingId: string, captureBefore: string, attempt: number): string {
  return `pi_rental_deposit_renew_${bookingId}_${captureBefore}_a${attempt}`;
}

export function depositCaptureKey(bookingId: string, amount: number): string {
  return `cap_rental_deposit_${bookingId}_${amount.toFixed(2)}`;
}

export function depositCancelKey(paymentIntentId: string): string {
  return `cancel_rental_deposit_${paymentIntentId}`;
}

export function remainderKey(bookingId: string): string {
  return `pi_rental_remainder_${bookingId}`;
}
