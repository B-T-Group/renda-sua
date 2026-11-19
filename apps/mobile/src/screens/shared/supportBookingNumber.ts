const BOOKING_NUMBER = /^RB-\d{8}$/;

/** A rental booking number is RB- and eight digits. Anything else is dropped. */
export function supportBookingNumber(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim().slice(0, 32);
  return BOOKING_NUMBER.test(trimmed) ? trimmed : '';
}
