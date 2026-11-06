import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchDeliverySlots, fetchNextAvailableDay } from '../services/deliveryWindowsApi';
import type { DeliveryTimeSlot } from '../types/deliveryWindow';
import {
  buildDayOptionYmDs,
  isSlotBookable,
  pickPreferredSlot,
  ymDsWithBookableSlots,
} from '../utils/deliveryWindowUtils';

const DAY_HORIZON = 21;

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

type SlotParams = {
  countryCode: string;
  stateCode: string;
  isFastDelivery: boolean;
  businessLocationId?: string;
};

async function loadSlotsForDate(
  params: SlotParams & { date: string }
): Promise<DeliveryTimeSlot[]> {
  try {
    return await fetchDeliverySlots(params);
  } catch {
    return [];
  }
}

async function prefetchHorizon(params: SlotParams): Promise<
  Array<{ date: string; slots: DeliveryTimeSlot[] }>
> {
  const candidates = buildDayOptionYmDs(null, DAY_HORIZON);
  return Promise.all(
    candidates.map(async (date) => ({
      date,
      slots: await loadSlotsForDate({ ...params, date }),
    }))
  );
}

async function resolveBookableCalendar(params: SlotParams): Promise<{
  days: string[];
  firstSlots: DeliveryTimeSlot[];
  firstDate: string | null;
  cache: Map<string, DeliveryTimeSlot[]>;
}> {
  const loaded = await prefetchHorizon(params);
  const cache = new Map(loaded.map((day) => [day.date, day.slots]));
  const days = ymDsWithBookableSlots(loaded);
  if (days.length > 0) {
    return { days, firstDate: days[0], firstSlots: cache.get(days[0]) ?? [], cache };
  }
  const next = await fetchNextAvailableDay(params);
  if (!next) {
    return { days: [], firstDate: null, firstSlots: [], cache };
  }
  cache.set(next.date, next.slots);
  return { days: [next.date], firstDate: next.date, firstSlots: next.slots, cache };
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
  const [dayOptions, setDayOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [resolved, setResolved] = useState(false);
  const slotsByDate = useRef<Map<string, DeliveryTimeSlot[]>>(new Map());

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const slotParams = useMemo(
    () => ({ countryCode, stateCode, isFastDelivery, businessLocationId }),
    [businessLocationId, countryCode, isFastDelivery, stateCode]
  );

  const applySlots = useCallback((list: DeliveryTimeSlot[], dateYmd: string) => {
    const bookable = list.filter(isSlotBookable);
    slotsByDate.current.set(dateYmd, list);
    setSlots(bookable);
    setPreferredDateState(dateYmd);
    setSlotId(pickPreferredSlot(bookable)?.id ?? null);
  }, []);

  const resetState = useCallback(() => {
    slotsByDate.current.clear();
    setSlots([]);
    setPreferredDateState(null);
    setSlotId(null);
    setDayOptions([]);
    setError(null);
    setLoading(false);
    setResolved(false);
  }, []);

  useEffect(() => {
    if (!enabled || !countryCode.trim() || !stateCode.trim()) {
      resetState();
      return;
    }
    let cancelled = false;
    setResolved(false);
    setLoading(true);
    setError(null);
    slotsByDate.current.clear();

    void (async () => {
      try {
        const calendar = await resolveBookableCalendar(slotParams);
        if (cancelled) return;
        slotsByDate.current = calendar.cache;
        setDayOptions(calendar.days);
        if (calendar.firstDate) {
          applySlots(calendar.firstSlots, calendar.firstDate);
        } else {
          setSlots([]);
          setPreferredDateState(null);
          setSlotId(null);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Delivery slots error');
        setSlots([]);
        setPreferredDateState(null);
        setSlotId(null);
        setDayOptions([]);
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
  }, [applySlots, countryCode, enabled, reloadKey, resetState, slotParams, stateCode]);

  const setPreferredDate = useCallback(
    (ymd: string) => {
      if (!enabled || !countryCode.trim() || !stateCode.trim()) return;
      const cached = slotsByDate.current.get(ymd);
      if (cached) {
        applySlots(cached, ymd);
        return;
      }
      void (async () => {
        setResolved(false);
        setLoading(true);
        setError(null);
        try {
          const list = await fetchDeliverySlots({ ...slotParams, date: ymd });
          applySlots(list, ymd);
          if (!list.some(isSlotBookable)) {
            setDayOptions((prev) => prev.filter((d) => d !== ymd));
          }
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
    [applySlots, countryCode, enabled, slotParams, stateCode]
  );

  useEffect(() => {
    const bookable = slots.filter(isSlotBookable);
    if (!bookable.length) {
      setSlotId(null);
      return;
    }
    setSlotId((cur) =>
      cur && bookable.some((s) => s.id === cur) ? cur : pickPreferredSlot(slots)?.id ?? null
    );
  }, [slots]);

  const canProceedWithOrder = useMemo(() => {
    if (!enabled) return true;
    if (!resolved || loading) return false;
    const bookable = slots.filter(isSlotBookable);
    if (!bookable.length) return dayOptions.length === 0;
    return !!(preferredDate && slotId && bookable.some((s) => s.id === slotId));
  }, [dayOptions.length, enabled, loading, preferredDate, resolved, slotId, slots]);

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
