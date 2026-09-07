import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Switch, Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import { useFoodSettings } from '../../../hooks/useFoodSettings';

export interface FoodSoldOutToggleProps {
  itemId: string;
  businessLocationId: string;
  /** Sold out for today when true. */
  initialSoldOut: boolean;
  onChanged?: () => void;
}

/**
 * One tap to take a dish off today's menu, for a kitchen mid-service.
 */
export function FoodSoldOutToggle({
  itemId,
  businessLocationId,
  initialSoldOut,
  onChanged,
}: FoodSoldOutToggleProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { setAvailableToday, saving } = useFoodSettings();
  const [soldOut, setSoldOut] = useState(initialSoldOut);

  useEffect(() => {
    setSoldOut(initialSoldOut);
  }, [initialSoldOut]);

  const handleChange = useCallback(
    async (available: boolean) => {
      const previous = soldOut;
      setSoldOut(!available);
      try {
        await setAvailableToday(itemId, businessLocationId, available);
        onChanged?.();
      } catch {
        setSoldOut(previous);
      }
    },
    [businessLocationId, itemId, onChanged, setAvailableToday, soldOut]
  );

  return (
    <View style={[styles.row, { gap: spacing.xs }]}>
      <Switch
        value={!soldOut}
        disabled={saving}
        onValueChange={(checked) => void handleChange(checked)}
        color={colors.primary.main}
      />
      <Text
        variant="bodySmall"
        style={[styles.label, { color: colors.text.primary }]}
      >
        {soldOut
          ? t('business.food.soldOutToday', 'Sold out for today')
          : t('business.food.onTheMenu', 'On the menu today')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  label: { flex: 1, minWidth: 0 },
});
