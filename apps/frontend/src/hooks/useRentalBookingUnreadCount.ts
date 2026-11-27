import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export const useRentalBookingUnreadCount = (
  bookingId: string | null | undefined
): { unreadCount: number; refresh: () => Promise<void> } => {
  const apiClient = useApiClient();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!apiClient || !bookingId) return;
    try {
      const response = await apiClient.get<{
        success: boolean;
        unreadCount?: number;
      }>(`/rentals/bookings/${bookingId}/messages/unread-count`);
      setUnreadCount(response.data.success ? response.data.unreadCount ?? 0 : 0);
    } catch {
      setUnreadCount(0);
    }
  }, [apiClient, bookingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { unreadCount, refresh };
};
