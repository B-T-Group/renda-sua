import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { FoodAvailabilitySlot } from '../../types/food';
import {
  foodWeekdayName,
  formatSlotRange,
  groupFoodSlotsByDay,
} from '../../utils/foodAvailability';

interface FoodScheduleListProps {
  slots: FoodAvailabilitySlot[];
}

/** Read-only weekly serving hours for a dish. */
export function FoodScheduleList({ slots }: FoodScheduleListProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const grouped = groupFoodSlotsByDay(slots);

  if (grouped.length === 0) {
    return (
      <Text style={[typography.body2, { color: colors.text.secondary }]}>
        {t('foods.schedule.alwaysAvailable', 'Available at any time')}
      </Text>
    );
  }

  return (
    <View style={{ gap: spacing.xs }}>
      {grouped.map((row) => (
        <View
          key={row.dayOfWeek}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <Text style={[typography.body2, { color: colors.text.primary, fontWeight: '600' }]}>
            {foodWeekdayName(row.dayOfWeek, i18n.language)}
          </Text>
          <Text
            style={[
              typography.body2,
              { color: colors.text.secondary, flexShrink: 1, textAlign: 'right' },
            ]}
          >
            {row.slots.map(formatSlotRange).join(', ')}
          </Text>
        </View>
      ))}
    </View>
  );
}
