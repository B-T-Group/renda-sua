import { useCallback, useEffect, useState } from 'react';
import { getInspection } from '../services/rentalInspectionApi';
import { isInspectionEnrolled, type InspectionView } from '../utils/rentals/rentalInspection';

export function useInspectionSnapshot(
  bookingId: string,
  booking: { inspection_policy_version?: number | null; status?: string } | null
) {
  const enrolled = isInspectionEnrolled(booking);
  const [pickup, setPickup] = useState<InspectionView | null>(null);
  const [returnView, setReturnView] = useState<InspectionView | null>(null);
  const [loading, setLoading] = useState(enrolled);

  const load = useCallback(async () => {
    if (!enrolled) {
      setPickup(null);
      setReturnView(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [pickupResult, returnResult] = await Promise.allSettled([
      getInspection(bookingId, 'pickup'),
      getInspection(bookingId, 'return'),
    ]);
    setPickup(pickupResult.status === 'fulfilled' ? pickupResult.value : null);
    setReturnView(returnResult.status === 'fulfilled' ? returnResult.value : null);
    setLoading(false);
  }, [bookingId, enrolled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { enrolled, pickup, returnView, loading, reload: load };
}
