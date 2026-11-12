import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import { RentalRequestBuilder, type RentalRequestBuilderProps } from './RentalRequestBuilder';

export interface RequestDayRow {
  id: string;
  label: string;
  removeLabel: string;
}

export interface RentalRequestScheduleCardProps extends RentalRequestBuilderProps {
  itemName: string;
  itemMeta?: string;
  imageUrl?: string | null;
  dateLine?: string;
  onEditDates?: () => void;
  datesFilled: boolean;
  unavailableLabel?: string;
  onSeeDates?: () => void;
  rows: RequestDayRow[];
  onRemove: (id: string) => void;
  builderOpen: boolean;
  onToggleBuilder: () => void;
}

export function RentalRequestScheduleCard(props: RentalRequestScheduleCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const card = [styles.card, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.lg }];

  return (
    <View style={card}>
      <ItemHead name={props.itemName} meta={props.itemMeta} imageUrl={props.imageUrl} />
      {props.dateLine ? (
        <DateLine dateLine={props.dateLine} onEditDates={props.onEditDates} />
      ) : null}
      {props.datesFilled || props.rows.length > 0 ? null : (
        <Text testID="rental-request-choose-dates" style={[styles.prompt, { color: colors.text.secondary, paddingHorizontal: spacing.sm }]}>
          {t('rentals.detail.requestSubtitle', 'Choose your dates. The business will confirm availability.')}
        </Text>
      )}
      {props.unavailableLabel ? (
        <Text testID="rental-request-unavailable" style={[styles.unavailable, { color: colors.warning.dark, paddingHorizontal: spacing.sm }]}>
          {props.unavailableLabel}
        </Text>
      ) : null}
      {props.onSeeDates && props.unavailableLabel ? (
        <Pressable testID="rental-request-see-dates" accessibilityRole="button" onPress={props.onSeeDates} style={styles.seeDates}>
          <MaterialCommunityIcons name="calendar" size={18} color={colors.primary.main} />
          <Text style={{ color: colors.primary.main, fontWeight: '700' }}>
            {t('rentals.searchFirst.seeDates', 'See dates')}
          </Text>
        </Pressable>
      ) : null}
      <DayList rows={props.rows} onRemove={props.onRemove} />
      <BuilderToggle open={props.builderOpen} onPress={props.onToggleBuilder} />
      {props.builderOpen ? <RentalRequestBuilder {...props} /> : null}
    </View>
  );
}

function ItemHead({ name, meta, imageUrl }: { name: string; meta?: string; imageUrl?: string | null }) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View style={[styles.item, { padding: spacing.sm, gap: spacing.sm }]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={[styles.thumb, { borderRadius: borderRadius.md }]} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { borderRadius: borderRadius.md, backgroundColor: colors.text.secondary }]}>
          <MaterialCommunityIcons name="warehouse" size={28} color={colors.primary.contrast} />
        </View>
      )}
      <View style={styles.itemText}>
        <Text style={[styles.itemName, { color: colors.text.primary }]} numberOfLines={2}>{name}</Text>
        {meta ? <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }}>{meta}</Text> : null}
      </View>
    </View>
  );
}

function DateLine({ dateLine, onEditDates }: { dateLine: string; onEditDates?: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View style={[styles.dateRow, { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, gap: spacing.xs }]}>
      <View style={[styles.cal, { backgroundColor: colors.primaryTint, borderRadius: borderRadius.sm }]}>
        <MaterialCommunityIcons name="calendar-outline" size={16} color={colors.primary.main} />
      </View>
      <Text testID="rental-request-dates" style={[styles.dateText, { color: colors.text.primary }]}>{dateLine}</Text>
      {onEditDates ? (
        <Pressable
          testID="rental-request-edit-dates"
          accessibilityRole="button"
          accessibilityLabel={t('rentals.searchFirst.edit', 'Edit')}
          onPress={onEditDates}
          hitSlop={8}
          style={styles.edit}
        >
          <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.primary.main} />
          <Text style={{ color: colors.primary.main, fontWeight: '700' }}>
            {t('rentals.searchFirst.edit', 'Edit')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DayList({ rows, onRemove }: { rows: RequestDayRow[]; onRemove: (id: string) => void }) {
  const { colors, spacing } = useTheme();
  if (rows.length === 0) return null;
  return (
    <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }}>
      {rows.map((row) => (
        <View key={row.id} testID={`rental-request-day-${row.id}`} style={[styles.day, { borderBottomColor: colors.divider, paddingHorizontal: spacing.sm }]}>
          <Text style={[styles.dayLabel, { color: colors.text.primary }]}>{row.label}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={row.removeLabel} onPress={() => onRemove(row.id)} hitSlop={8}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error.main} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function BuilderToggle({ open, onPress }: { open: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const label = t('rentals.requestForm.addOrChangeTimes', 'Add or change times');
  return (
    <Pressable
      testID="rental-request-add-times"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={[
        styles.toggle,
        {
          borderTopColor: colors.divider,
          backgroundColor: open ? colors.pageBackground : colors.surface,
          paddingHorizontal: spacing.sm,
        },
      ]}
    >
      <View style={[styles.plus, { backgroundColor: colors.primaryTint, borderRadius: borderRadius.sm }]}>
        <MaterialCommunityIcons name={open ? 'minus' : 'plus'} size={16} color={colors.primary.main} />
      </View>
      <Text style={[styles.toggleLabel, { color: colors.primary.main }]}>{label}</Text>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary.main} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center' },
  itemText: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: '800' },
  thumb: { width: 64, height: 64 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  cal: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dateText: { flex: 1, fontSize: 15, fontWeight: '800' },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  prompt: { fontSize: 13, marginBottom: 8 },
  unavailable: { fontWeight: '700', marginBottom: 4 },
  seeDates: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  plus: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
});
