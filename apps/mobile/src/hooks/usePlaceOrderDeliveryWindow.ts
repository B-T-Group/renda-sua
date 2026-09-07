import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDeliverySlots, fetchNextAvailableDay } from '../services/deliveryWindowsApi';
import type { DeliveryTimeSlot } from '../types/deliveryWindow';
import {
  buildDayOptionYmDs,
  isSlotBookable,
  pickPreferredSlot,
  toYmd,
} from '../utils/deliveryWindowUtils';

export interface UsePlaceOrderDeliveryWindowArgs {
  countryCode: string;
  stateCode: string;
  enabled: boolean;
  isFastDelivery?: boolean;
  /** When provided, only slots fully contained within this location's operating hours are returned. */
  businessLocationId?: string;
}

export interface UsePlaceOrderDeliveryWindowResult {
  preferredDate: string | null;
  setPreferredDate: (ymd: string) => void;
  slotId: string | null;
  setSlotId: (id: string) => void;
  slots: DeliveryTimeSlot[];
  dayOptions: string[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  canProceedWithOrder: boolean;
}

export function usePlaceOrderDeliveryWindow({
  countryCode,
  stateCode,
  enabled,
  isFastDelivery = false,
  businessLocationId,
}: UsePlaceOrderDeliveryWindowArgs): UsePlaceOrderDeliveryWindowResult {
  const [preferredDate, setPreferredDateState] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [slots, setSlots] = useState<DeliveryTimeSlot[]>([]);
  const [nextDayYmd, setNextDayYmd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [resolved, setResolved] = useState(false);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const dayOptions = useMemo(() => buildDayOptionYmDs(nextDayYmd, 21), [nextDayYmd]);

  const applySlots = useCallback((list: DeliveryTimeSlot[], dateYmd: string) => {
    setSlots(list);
    setPreferredDateState(dateYmd);
    const pick = pickPreferredSlot(list);
    setSlotId(pick?.id ?? null);
  }, []);

  useEffect(() => {
    if (!enabled || !countryCode.trim() || !stateCode.trim()) {
      setSlots([]);
      setPreferredDateState(null);
      setSlotId(null);
      setNextDayYmd(null);
      setError(null);
      setLoading(false);
      setResolved(false);
      return;
    }

    let cancelled = false;
    setResolved(false);
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const next = await fetchNextAvailableDay({
          countryCode,
          stateCode,
          isFastDelivery,
          businessLocationId,
        });
        if (cancelled) return;
        if (next) {
          setNextDayYmd(next.date);
          applySlots(next.slots, next.date);
        } else {
          // No next-available day from the API — still anchor the calendar on
          // today so the day strip stays visible and users can try other dates.
          setNextDayYmd(null);
          const today = toYmd(new Date());
          try {
            const list = await fetchDeliverySlots({
              countryCode,
              stateCode,
              date: today,
              isFastDelivery,
              businessLocationId,
            });
            if (cancelled) return;
            applySlots(list, today);
          } catch {
            if (cancelled) return;
            setSlots([]);
            setPreferredDateState(today);
            setSlotId(null);
          }
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Delivery slots error');
        setSlots([]);
        setPreferredDateState(null);
        setSlotId(null);
        setNextDayYmd(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setResolved(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySlots, countryCode, enabled, isFastDelivery, reloadKey, stateCode, businessLocationId]);

  const setPreferredDate = useCallback(
    (ymd: string) => {
      if (!enabled || !countryCode.trim() || !stateCode.trim()) return;

      void (async () => {
        setResolved(false);
        setLoading(true);
        setError(null);
        try {
          const list = await fetchDeliverySlots({
            countryCode,
            stateCode,
            date: ymd,
            isFastDelivery,
            businessLocationId,
          });
          applySlots(list, ymd);
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Delivery slots error');
          setSlots([]);
          setSlotId(null);
        } finally {
          setLoading(false);
          setResolved(true);
        }
      })();
    },
    [applySlots, countryCode, enabled, isFastDelivery, stateCode, businessLocationId]
  );

  useEffect(() => {
    const bookable = slots.filter(isSlotBookable);
    if (!bookable.length) {
      setSlotId(null);
      return;
    }
    setSlotId((cur) => (cur && bookable.some((s) => s.id === cur) ? cur : pickPreferredSlot(slots)?.id ?? null));
  }, [slots]);

  const bookable = useMemo(() => slots.filter(isSlotBookable), [slots]);
  const canProceedWithOrder = useMemo(() => {
    if (!enabled) return true;
    if (!resolved || loading) return false;
    const b = slots.filter(isSlotBookable);
    if (!b.length) return true;
    return !!(preferredDate && slotId && b.some((s) => s.id === slotId));
  }, [enabled, resolved, loading, preferredDate, slotId, slots]);

  return {
    preferredDate,
    setPreferredDate,
    slotId,
    setSlotId,
    slots,
    dayOptions,
    loading,
    error,
    reload,
    canProceedWithOrder,
  };
}
