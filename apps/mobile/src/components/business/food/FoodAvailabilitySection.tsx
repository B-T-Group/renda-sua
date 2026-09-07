import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Switch, Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import { useFoodSettings } from '../../../hooks/useFoodSettings';
import type { FoodAvailabilitySlot, FoodSettings } from '../../../types/food';
import { formatSlotTime, isValidFoodTime } from '../../../utils/foodAvailability';
import { FoodAvailabilityEditor } from './FoodAvailabilityEditor';

export interface FoodAvailabilitySectionProps {
  itemId: string;
  businessLocationId: string;
}

function normalizeSlots(slots: FoodAvailabilitySlot[]): FoodAvailabilitySlot[] | null {
  const next = slots.map((slot) => ({
    ...slot,
    start_time: formatSlotTime(slot.start_time),
    end_time: formatSlotTime(slot.end_time),
  }));
  const invalid = next.some(
    (slot) => !isValidFoodTime(slot.start_time) || !isValidFoodTime(slot.end_time)
  );
  return invalid ? null : next;
}

/**
 * Loads and saves the serving schedule for one dish at one location, plus the
 * sold-out-for-today switch.
 */
export function FoodAvailabilitySection({
  itemId,
  businessLocationId,
}: FoodAvailabilitySectionProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { loading, saving, error, fetchSettings, saveSlots, setAvailableToday } =
    useFoodSettings();
  const [settings, setSettings] = useState<FoodSettings | null>(null);
  const [slots, setSlots] = useState<FoodAvailabilitySlot[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const resetEditor = useCallback(() => {
    setSettings(null);
    setSlots([]);
    setDirty(false);
    setSaved(false);
    setLocalError(null);
    setLoadFailed(false);
  }, []);

  const applyLoaded = useCallback((loaded: FoodSettings | null) => {
    if (!loaded) {
      setLoadFailed(true);
      return;
    }
    setSettings(loaded);
    setSlots(loaded.slots);
    setLoadFailed(false);
    setDirty(false);
  }, []);

  useEffect(() => {
    let active = true;
    resetEditor();
    if (!itemId || !businessLocationId) return;
    void (async () => {
      const loaded = await fetchSettings(itemId, businessLocationId);
      if (active) applyLoaded(loaded);
    })();
    return () => {
      active = false;
    };
  }, [applyLoaded, businessLocationId, fetchSettings, itemId, resetEditor]);

  const handleSlotsChange = useCallback((next: FoodAvailabilitySlot[]) => {
    setSlots(next);
    setDirty(true);
    setSaved(false);
    setLocalError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    const normalized = normalizeSlots(slots);
    if (!normalized) {
      setLocalError(t('business.food.invalidHours', 'Use HH:mm times such as 12:30.'));
      return;
    }
    try {
      const updated = await saveSlots(itemId, businessLocationId, normalized);
      setSettings(updated);
      setSlots(updated.slots);
      setDirty(false);
      setSaved(true);
    } catch {
      // useFoodSettings surfaces the message through `error`.
    }
  }, [businessLocationId, itemId, saveSlots, settings, slots, t]);

  const handleAvailableToggle = useCallback(
    async (available: boolean) => {
      if (!settings) return;
      try {
        const updated = await setAvailableToday(itemId, businessLocationId, available);
        setSettings(updated);
      } catch {
        // useFoodSettings surfaces the message through `error`.
      }
    },
    [businessLocationId, itemId, setAvailableToday, settings]
  );

  const retryLoad = useCallback(() => {
    resetEditor();
    void fetchSettings(itemId, businessLocationId).then(applyLoaded);
  }, [applyLoaded, businessLocationId, fetchSettings, itemId, resetEditor]);

  if (!settings && !loadFailed) {
    return <ActivityIndicator style={styles.loader} />;
  }

  if (loadFailed || !settings) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Text variant="bodySmall" style={{ color: colors.error.main }}>
          {error ?? t('business.food.loadHoursFailed', 'Could not load serving hours.')}
        </Text>
        <Button mode="outlined" onPress={retryLoad} loading={loading}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  const soldOutToday = settings?.is_marked_unavailable_today === true;
  const displayError = localError ?? error;

  return (
    <View style={{ gap: spacing.sm }}>
      {displayError ? (
        <Text variant="bodySmall" style={{ color: colors.error.main }}>
          {displayError}
        </Text>
      ) : null}
      <View style={styles.switchRow}>
        <Text variant="bodyMedium" style={styles.switchLabel}>
          {soldOutToday
            ? t('business.food.soldOutToday', 'Sold out for today')
            : t('business.food.onTheMenu', 'On the menu today')}
        </Text>
        <Switch
          value={!soldOutToday}
          disabled={saving}
          onValueChange={(checked) => void handleAvailableToggle(checked)}
          color={colors.primary.main}
        />
      </View>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t(
          'business.food.soldOutHelp',
          'Turning this off hides the dish for the rest of the day. It comes back automatically the next day you serve it.'
        )}
      </Text>
      <FoodAvailabilityEditor
        slots={slots}
        onChange={handleSlotsChange}
        disabled={saving}
      />
      <View style={[styles.saveRow, { gap: spacing.sm }]}>
        <Button
          mode="outlined"
          onPress={() => void handleSave()}
          disabled={!dirty || saving}
          loading={saving && dirty}
        >
          {t('business.food.saveHours', 'Save serving hours')}
        </Button>
        {saved && !dirty ? (
          <Text variant="bodySmall" style={{ color: colors.success.main }}>
            {t('business.food.hoursSaved', 'Serving hours saved')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: 16 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  switchLabel: { flex: 1, minWidth: 0 },
  saveRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
