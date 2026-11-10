import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';
import { createRentalInspectionApi, hydrateInspectionPhotos } from '../services/rentalInspectionApi';
import {
  classifyInspectionError,
  clientInspectionAction,
  isInspectionEnrolled,
  normalizeAccessories,
  pickupGate,
  showEnrolledReturn,
  showLegacyReturnPicker,
  type InspectionStage,
  type InspectionView,
} from '../utils/rentalInspection';

export interface InspectionBookingGate {
  inspection_policy_version?: number | null;
  status?: string;
}

async function loadStage(
  api: ReturnType<typeof createRentalInspectionApi>,
  bookingId: string,
  stage: InspectionStage
): Promise<InspectionView> {
  const current = await api.get(bookingId, stage);
  const units = await hydrateInspectionPhotos(
    api,
    bookingId,
    current.units.map((unit) => ({
      ...unit,
      accessories: normalizeAccessories(unit.accessories),
    }))
  );
  return { ...current, units };
}

export function useRentalInspection(
  bookingId: string | undefined,
  booking: InspectionBookingGate | null
) {
  const http = useApiClient();
  const api = useMemo(() => createRentalInspectionApi(http), [http]);
  const enrolled = isInspectionEnrolled(booking);
  const [pickup, setPickup] = useState<InspectionView | null>(null);
  const [returnView, setReturnView] = useState<InspectionView | null>(null);
  const [loading, setLoading] = useState(enrolled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!bookingId || !enrolled) {
      setPickup(null);
      setReturnView(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [pickupResult, returnResult] = await Promise.allSettled([
      loadStage(api, bookingId, 'pickup'),
      loadStage(api, bookingId, 'return'),
    ]);
    setPickup(pickupResult.status === 'fulfilled' ? pickupResult.value : null);
    setReturnView(returnResult.status === 'fulfilled' ? returnResult.value : null);
    const failed = [pickupResult, returnResult].find((row) => row.status === 'rejected');
    setError(failed && failed.status === 'rejected' ? classifyInspectionError(failed.reason) : null);
    setLoading(false);
  }, [api, bookingId, enrolled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const gate = pickupGate({
    enrolled,
    status: booking?.status ?? '',
    submitted: pickup?.status === 'submitted' && !pickup.yourDecision,
    accepted: pickup?.yourDecision === 'accept',
  });
  const reviewAction = clientInspectionAction({
    status: booking?.status ?? '',
    pickup,
    returnView,
  });

  return {
    api,
    enrolled,
    pickup,
    returnView,
    loading,
    error,
    reload,
    gate,
    reviewStage: (reviewAction === 'review_pickup'
      ? 'pickup'
      : reviewAction === 'review_return'
        ? 'return'
        : null) as InspectionStage | null,
    showLegacyReturn: showLegacyReturnPicker(enrolled, booking?.status ?? ''),
    showEnrolledReturn: showEnrolledReturn(enrolled, booking?.status ?? ''),
  };
}
