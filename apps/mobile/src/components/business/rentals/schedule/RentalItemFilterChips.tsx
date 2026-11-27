import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../../../contexts/ThemeContext';
import {
  ALL_SCHEDULE_ITEMS,
  type ScheduleItemOption,
} from '../../../../hooks/useBusinessRentalSchedule';

export interface RentalItemFilterChipsProps {
  items: ScheduleItemOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors, spacing, borderRadius } = useTheme();
  const color = selected ? colors.primary.main : colors.text.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderRadius: borderRadius.full,
          paddingHorizontal: spacing.sm,
          borderColor: selected ? colors.primary.main : colors.divider,
          backgroundColor: selected ? colors.primaryTint : colors.surface,
        },
      ]}
    >
      <Text numberOfLines={1} style={{ color, fontSize: 13, fontWeight: selected ? '600' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Horizontal "Rental item" filter with an All option; hidden when there is nothing to choose. */
export function RentalItemFilterChips({ items, selectedId, onSelect }: RentalItemFilterChipsProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  if (items.length < 2) return null;
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={[typography.body2, { color: colors.text.secondary, marginBottom: spacing.xs }]}>
        {t('business.rentals.schedule.pickItem', 'Rental item')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip
          label={t('business.rentals.schedule.allItems', 'All')}
          selected={selectedId === ALL_SCHEDULE_ITEMS}
          onPress={() => onSelect(ALL_SCHEDULE_ITEMS)}
        />
        {items.map((item) => (
          <Chip key={item.id} label={item.name} selected={selectedId === item.id} onPress={() => onSelect(item.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { flexShrink: 0, maxWidth: 220, minHeight: 36, justifyContent: 'center', borderWidth: 1 },
});
