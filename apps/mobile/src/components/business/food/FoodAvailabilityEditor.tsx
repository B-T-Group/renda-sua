import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import type { FoodAvailabilitySlot } from '../../../types/food';
import {
  editorRowsToFoodSlots,
  foodSlotsHaveMultipleWindowsPerDay,
  foodSlotsToEditorRows,
} from '../../../utils/foodHoursEditor';
import { OperatingHoursEditor } from '../OperatingHoursEditor';

export interface FoodAvailabilityEditorProps {
  slots: FoodAvailabilitySlot[];
  onChange: (slots: FoodAvailabilitySlot[]) => void;
  disabled?: boolean;
}

/**
 * Weekly serving hours using the same day/time control as location hours.
 * Every day off keeps the dish on the menu at all times.
 */
export function FoodAvailabilityEditor({
  slots,
  onChange,
  disabled = false,
}: FoodAvailabilityEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View>
      <OperatingHoursEditor
        value={foodSlotsToEditorRows(slots)}
        onChange={(rows) => onChange(editorRowsToFoodSlots(rows))}
        disabled={disabled}
        title={t('business.food.servingHours', 'Serving hours')}
        hint={t(
          'business.food.servingHoursHelp',
          'Set the times this dish is served. Leave every day empty to keep it on the menu at all times.'
        )}
        offDayLabel={t('business.food.notAvailable', 'Not available')}
      />
      {foodSlotsHaveMultipleWindowsPerDay(slots) ? (
        <Text variant="bodySmall" style={[styles.warning, { color: colors.warning.main }]}>
          {t(
            'business.food.extraWindowsWillBeDropped',
            'This dish had more than one serving window on some days. Saving keeps one window per day.'
          )}
        </Text>
      ) : null}
      {slots.length === 0 ? (
        <Text variant="bodySmall" style={[styles.info, { color: colors.text.secondary }]}>
          {t(
            'business.food.noHoursSet',
            'No hours set, so this dish can be ordered at any time.'
          )}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  info: { fontStyle: 'italic', marginTop: 8 },
  warning: { marginTop: 8 },
});
