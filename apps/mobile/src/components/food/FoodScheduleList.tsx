import { useState } from 'react';
import { Pressable, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { FoodAvailabilitySlot } from '../../types/food';
import {
  foodWeekdayName,
  formatSlotRange,
  groupFoodSlotsByDay,
  weekdayInTimezone,
} from '../../utils/foodAvailability';

interface FoodScheduleListProps {
  slots: FoodAvailabilitySlot[];
  timezone?: string;
}

/** Read-only weekly serving hours. Collapsed to today until opened. */
export function FoodScheduleList({ slots, timezone }: FoodScheduleListProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const grouped = groupFoodSlotsByDay(slots);

  if (grouped.length === 0) {
    return (
      <Text style={[typography.body2, { color: colors.text.secondary }]}>
        {t('foods.schedule.alwaysAvailable', 'Available at any time')}
      </Text>
    );
  }

  const today = weekdayInTimezone(timezone);
  const days = open ? grouped.map((row) => row.dayOfWeek) : [today];
  const rangesByDay = new Map(grouped.map((row) => [row.dayOfWeek, row.slots]));

  return (
    <View style={{ gap: spacing.xs }}>
      <ScheduleToggle open={open} onToggle={() => setOpen((value) => !value)} />
      {days.map((day) => (
        <DayHours
          key={day}
          name={foodWeekdayName(day, i18n.language)}
          ranges={rangesForDay(rangesByDay.get(day)) ?? t('foods.schedule.closedToday', 'Closed')}
          emphasize={day === today}
        />
      ))}
    </View>
  );
}

function rangesForDay(slots: FoodAvailabilitySlot[] | undefined): string | null {
  if (!slots?.length) return null;
  return slots.map(formatSlotRange).join(', ');
}

function ScheduleToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const label = t('foods.schedule.title', 'Serving hours');
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs / 2,
      }}
    >
      <Text style={[typography.caption, { color: colors.text.secondary, fontWeight: '600' }]}>
        {label}
      </Text>
      <MaterialCommunityIcons
        name={open ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={colors.text.secondary}
      />
    </Pressable>
  );
}

function DayHours({
  name,
  ranges,
  emphasize,
}: {
  name: string;
  ranges: string;
  emphasize: boolean;
}) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <Text
        style={[
          typography.body2,
          { color: colors.text.primary, fontWeight: emphasize ? '700' : '600' },
        ]}
      >
        {name}
      </Text>
      <Text
        style={[
          typography.body2,
          { color: colors.text.secondary, flexShrink: 1, textAlign: 'right' },
        ]}
      >
        {ranges}
      </Text>
    </View>
  );
}
