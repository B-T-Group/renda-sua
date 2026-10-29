/**
 * #594 addendum: agent preferred delivery slots, shared between
 * Settings → Availability and the Dedicated tab chip row (AC-P2). A tiny
 * module-level cache keeps both in sync within the session.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dedicatedAgentsService from '../services/dedicatedAgentsService';
import type { SlotKey, SlotOffConflict, SlotPreferences } from '../types/dedicatedAgents';
import { formatStoreNames, isAllOff, parseSlotOffConflict } from '../utils/slotPrefs';

let cached: SlotPreferences | null = null;
const listeners = new Set<(p: SlotPreferences | null) => void>();
function publish(p: SlotPreferences | null) {
  cached = p;
  listeners.forEach((l) => l(p));
}
/** Test helper. */
export function __resetSlotPrefsCache() {
  cached = null;
  listeners.clear();
}

export interface PendingSlotOff {
  slot: SlotKey;
  stores: SlotOffConflict['stores'];
}

export interface SlotPreferencesState {
  prefs: SlotPreferences | null;
  allOff: boolean;
  loading: boolean;
  error: boolean;
  savingSlot: SlotKey | null;
  pending: PendingSlotOff | null;
  message: string | null;
  setSlot: (slot: SlotKey, on: boolean) => Promise<void>;
  confirmPending: () => Promise<void>;
  cancelPending: () => void;
  clearMessage: () => void;
  reload: () => Promise<void>;
  slotLabel: (slot: SlotKey) => string;
  pendingStoreNames: string;
}

export function useSlotPreferences(opts?: { onPaused?: (ids: string[]) => void }): SlotPreferencesState {
  const { t } = useTranslation();
  const onPaused = opts?.onPaused;
  const [prefs, setPrefs] = useState<SlotPreferences | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState(false);
  const [savingSlot, setSavingSlot] = useState<SlotKey | null>(null);
  const [pending, setPending] = useState<PendingSlotOff | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listeners.add(setPrefs);
    return () => {
      listeners.delete(setPrefs);
    };
  }, []);

  const slotLabel = useCallback((slot: SlotKey) => t(`slotPrefs.slots.${slot}`), [t]);

  const reload = useCallback(async () => {
    try {
      const res = await dedicatedAgentsService.getSlotPreferences();
      publish(res.preferences);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(
    async (slot: SlotKey, on: boolean, confirmPause: boolean) => {
      const before = cached;
      setSavingSlot(slot);
      // Optimistic only for ON / confirmed OFF, so a 409 never flickers the toggle off (AC-P4).
      if (before && (on || confirmPause)) publish({ ...before, [slot]: on });
      try {
        const res = await dedicatedAgentsService.updateSlotPreferences(
          confirmPause ? { [slot]: on, confirmPause: true } : { [slot]: on }
        );
        publish(res.preferences);
        const paused = res.pausedAssignmentIds ?? [];
        const label = slotLabel(slot);
        setMessage(
          on
            ? t('slotPrefs.toastOn', { slot: label })
            : paused.length > 0
              ? t('slotPrefs.toastOffPaused', { slot: label, count: paused.length })
              : t('slotPrefs.toastOff', { slot: label })
        );
        if (paused.length > 0) onPaused?.(paused);
      } catch (err) {
        if (before) publish(before);
        const conflict = !on && !confirmPause ? parseSlotOffConflict(err) : null;
        if (conflict && conflict.stores.length > 0) {
          // AC-P3: confirm only when the backend lists affected stores.
          setPending({ slot, stores: conflict.stores });
        } else {
          setMessage(t('slotPrefs.saveError'));
        }
      } finally {
        setSavingSlot(null);
      }
    },
    [onPaused, slotLabel, t]
  );

  const setSlot = useCallback((slot: SlotKey, on: boolean) => save(slot, on, false), [save]);

  const confirmPending = useCallback(async () => {
    if (!pending) return;
    const { slot } = pending;
    setPending(null);
    await save(slot, false, true);
  }, [pending, save]);

  const cancelPending = useCallback(() => setPending(null), []); // AC-P4: toggle stays ON

  return {
    prefs,
    allOff: prefs ? isAllOff(prefs) : false,
    loading,
    error,
    savingSlot,
    pending,
    message,
    setSlot,
    confirmPending,
    cancelPending,
    clearMessage: () => setMessage(null),
    reload,
    slotLabel,
    pendingStoreNames: pending
      ? formatStoreNames(pending.stores, t('slotPrefs.storeFallback'))
      : '',
  };
}
