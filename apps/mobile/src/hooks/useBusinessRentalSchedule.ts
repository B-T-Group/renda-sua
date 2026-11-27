import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rentalsApi } from '../services/rentalsApi';
import type { BusinessRentalScheduleRow } from '../types/rentals';
import { mergeScheduleRows } from '../utils/rentals/businessSchedule';

export const ALL_SCHEDULE_ITEMS = 'all';

export interface ScheduleItemOption {
  id: string;
  name: string;
}

export function useBusinessRentalSchedule(items: ScheduleItemOption[]) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string>(ALL_SCHEDULE_ITEMS);
  const [rows, setRows] = useState<BusinessRentalScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemKey = items.map((item) => item.id).join(',');

  const activeId =
    selectedId === ALL_SCHEDULE_ITEMS || items.some((item) => item.id === selectedId)
      ? selectedId
      : ALL_SCHEDULE_ITEMS;

  const fetchRows = useCallback(async () => {
    const ids = activeId === ALL_SCHEDULE_ITEMS ? itemKey.split(',').filter(Boolean) : [activeId];
    const lists = await Promise.all(ids.map((id) => rentalsApi.getBusinessSchedule(id)));
    return mergeScheduleRows(lists);
  }, [activeId, itemKey]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchRows());
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : t('business.rentals.schedule.loadError', 'Could not load the schedule')
      );
    }
  }, [fetchRows, t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { rows, selectedId: activeId, setSelectedId, loading, refreshing, error, refresh };
}
