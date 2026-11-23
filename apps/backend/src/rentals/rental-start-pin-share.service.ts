import { Injectable } from '@nestjs/common';
import type { RentalBookingMessage } from './rental-booking-messaging.service';
import { pinRetired } from './simple-start/simple-start.errors';

/** Start PINs are retired. Old chat cards stay masked and never reveal a code. */
@Injectable()
export class RentalStartPinShareService {
  async shareStartPin(bookingId: string): Promise<RentalBookingMessage> {
    return this.retired(bookingId);
  }

  async getActiveStartPinForBusiness(bookingId: string): Promise<never> {
    return this.retired(bookingId);
  }

  enrichPinPayload(
    payload: Record<string, unknown>,
    viewerUserId: string,
    viewerPersona: 'client' | 'business',
    booking: unknown
  ): Record<string, unknown> {
    void payload;
    void viewerUserId;
    void viewerPersona;
    void booking;
    return { status: 'retired', retired: true, maskedDisplay: '****' };
  }

  private retired(bookingId: string): never {
    void bookingId;
    throw pinRetired();
  }
}
