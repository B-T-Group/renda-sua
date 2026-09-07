import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelBooking,
  getBooking,
  getPaymentStatus,
  getStartPin,
  retryPayment,
} from '../services/rentalsApi';
import type {
  CreateRentalBookingResult,
  RentalBookingDetail,
  RentalBookingPaymentStatus,
} from '../types/rentals';

const PAYMENT_POLL_MS = 4000;

export interface UseRentalBookingDetailOptions {
  /** Poll payment-status while booking status is `proposed`. Default true. */
  pollPaymentWhenProposed?: boolean;
}

export function useRentalBookingDetail(
  bookingId: string | undefined,
  options: UseRentalBookingDetailOptions = {}
) {
  const { pollPaymentWhenProposed = true } = options;
  const [booking, setBooking] = useState<RentalBookingDetail | null>(null);
  const [paymentStatus, setPaymentStatus] =
    useState<RentalBookingPaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (id: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const row = await getBooking(id, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setBooking(row);
      setError(row ? null : 'Booking not found');
      if (row?.status === 'proposed') {
        try {
          const pay = await getPaymentStatus(id, { signal: controller.signal });
          if (!controller.signal.aborted) setPaymentStatus(pay);
        } catch {
          if (!controller.signal.aborted) setPaymentStatus(null);
        }
      } else {
        setPaymentStatus(null);
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'Failed to load booking');
      setBooking(null);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!bookingId?.trim()) {
      setBooking(null);
      setPaymentStatus(null);
      setLoading(false);
      setError('Missing booking');
      return;
    }
    void load(bookingId.trim());
    return () => {
      abortRef.current?.abort();
    };
  }, [bookingId, load]);

  useEffect(() => {
    if (!pollPaymentWhenProposed) return;
    if (!bookingId?.trim() || booking?.status !== 'proposed') return;
    const id = bookingId.trim();
    const timer = setInterval(() => {
      void (async () => {
        try {
          const pay = await getPaymentStatus(id);
          setPaymentStatus(pay);
          if (pay.status !== 'proposed') {
            const row = await getBooking(id);
            if (row) setBooking(row);
          }
        } catch {
          /* keep last known status */
        }
      })();
    }, PAYMENT_POLL_MS);
    return () => clearInterval(timer);
  }, [bookingId, booking?.status, pollPaymentWhenProposed]);

  const refetch = useCallback(async () => {
    if (bookingId?.trim()) await load(bookingId.trim());
  }, [bookingId, load]);

  const cancel = useCallback(async () => {
    if (!bookingId?.trim()) return;
    setActionLoading(true);
    try {
      const res = await cancelBooking(bookingId.trim());
      await load(bookingId.trim());
      return res;
    } finally {
      setActionLoading(false);
    }
  }, [bookingId, load]);

  const retryPay = useCallback(
    async (options?: {
      stripe_payment_method?: 'payment_sheet';
    }): Promise<CreateRentalBookingResult> => {
      if (!bookingId?.trim()) {
        throw new Error('Missing booking');
      }
      setActionLoading(true);
      try {
        const res = await retryPayment(bookingId.trim(), options);
        await load(bookingId.trim());
        return res;
      } finally {
        setActionLoading(false);
      }
    },
    [bookingId, load]
  );

  const fetchStartPin = useCallback(async () => {
    if (!bookingId?.trim()) throw new Error('Missing booking');
    return getStartPin(bookingId.trim());
  }, [bookingId]);

  return {
    booking,
    paymentStatus,
    loading,
    error,
    actionLoading,
    refetch,
    cancel,
    retryPayment: retryPay,
    getStartPin: fetchStartPin,
  };
}
