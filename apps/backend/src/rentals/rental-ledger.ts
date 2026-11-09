import { HttpException, HttpStatus } from '@nestjs/common';

/** Stable ledger key. Replays of the same leg hit the same row. */
export function rentalLedgerKey(bookingId: string, leg: string): string {
  return `rental:${bookingId}:${leg}`;
}

export function rentalProceedsLeg(label: string): string {
  if (label === 'Overtime') return 'overtime';
  return 'stripe-capture';
}

export function assertLedgerResult(
  result: { success: boolean; error?: string } | null | undefined,
  leg: string
): void {
  if (result?.success) return;
  throw new HttpException(
    result?.error || `Rental ${leg} failed`,
    HttpStatus.BAD_GATEWAY
  );
}
