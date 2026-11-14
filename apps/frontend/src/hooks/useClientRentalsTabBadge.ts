import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import {
  formatMyRentalsBadge,
  myRentalsTodoCount,
  type TodoBooking,
  type TodoRequest,
} from '../utils/myRentalsTodoCount';

type RequestsBody = { success?: boolean; data?: { requests?: TodoRequest[] } };
type BookingsBody = { success?: boolean; data?: { bookings?: TodoBooking[] } };

/** #811 To do count for the web Rentals tab. A failed refresh keeps the last count. */
export function useClientRentalsTabBadge(enabled: boolean): { badge: string | null; count: number } {
  const apiClient = useApiClient();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled || !apiClient) return undefined;
    let live = true;
    void Promise.all([
      apiClient.get<RequestsBody>('/rentals/client/requests'),
      apiClient.get<BookingsBody>('/rentals/client/bookings'),
    ])
      .then(([requestsRes, bookingsRes]) => {
        if (!live) return;
        const requests = requestsRes.data?.data?.requests ?? [];
        const bookings = bookingsRes.data?.data?.bookings ?? [];
        setCount(myRentalsTodoCount(requests, bookings, new Date()));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [apiClient, enabled]);

  return { badge: formatMyRentalsBadge(count), count };
}
