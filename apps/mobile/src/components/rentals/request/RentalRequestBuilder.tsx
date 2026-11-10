import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Checkbox, Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';

export interface RequestChip {
  key: string;
  weekday: string;
  day: string;
  selected: boolean;
}

export interface RentalRequestBuilderProps {
  chips: RequestChip[];
  onPickChip: (key: string) => void;
  startValue: string;
  endValue: string;
  onPressStart: () => void;
  onPressEnd: () => void;
  timesDisabled: boolean;
  allDayChecked: boolean;
  allDayEnabled: boolean;
  allDayHint?: string;
  onToggleAllDay: () => void;
  onAdd: () => void;
  addDisabled: boolean;
  closedDayLabel?: string;
}

export function RentalRequestBuilder(props: RentalRequestBuilderProps) {
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View testID="rental-request-builder" style={[styles.wrap, { backgroundColor: colors.pageBackground, padding: spacing.sm, gap: spacing.sm }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {props.chips.map((chip) => (
          <ChipButton key={chip.key} chip={chip} onPress={() => props.onPickChip(chip.key)} />
        ))}
      </ScrollView>
      {props.closedDayLabel ? (
        <Text style={{ color: colors.warning.dark }}>{props.closedDayLabel}</Text>
      ) : (
        <OpenDayFields {...props} radius={borderRadius.md} />
      )}
    </View>
  );
}

function ChipButton({ chip, onPress }: { chip: RequestChip; onPress: () => void }) {
  const { colors } = useTheme();
  const on = chip.selected;
  return (
    <Pressable
      testID={`rental-request-chip-${chip.key}`}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: on ? colors.primary.main : colors.surface,
          borderColor: on ? colors.primary.main : colors.divider,
        },
      ]}
    >
      <Text style={{ color: on ? colors.primary.contrast : colors.text.secondary, fontSize: 11, fontWeight: '700' }}>
        {chip.weekday}
      </Text>
      <Text style={{ color: on ? colors.primary.contrast : colors.text.primary, fontSize: 13, fontWeight: '800' }}>
        {chip.day}
      </Text>
    </Pressable>
  );
}

function OpenDayFields(props: RentalRequestBuilderProps & { radius: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toggle = () => {
    if (props.allDayEnabled) props.onToggleAllDay();
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.times}>
        <TimeField
          label={t('rentals.requestForm.slotStart', 'Start time')}
          value={props.startValue}
          disabled={props.timesDisabled}
          onPress={props.onPressStart}
          radius={props.radius}
        />
        <TimeField
          label={t('rentals.requestForm.slotEnd', 'End time')}
          value={props.endValue}
          disabled={props.timesDisabled}
          onPress={props.onPressEnd}
          radius={props.radius}
        />
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: props.allDayChecked, disabled: !props.allDayEnabled }}
        disabled={!props.allDayEnabled}
        onPress={toggle}
        style={[styles.fullDay, { opacity: props.allDayEnabled ? 1 : 0.5 }]}
      >
        <Checkbox
          status={props.allDayChecked ? 'checked' : 'unchecked'}
          disabled={!props.allDayEnabled}
          onPress={toggle}
        />
        <Text style={{ color: colors.text.primary, fontWeight: '700', flexShrink: 1 }}>
          {t('rentals.requestForm.addFullDayRate', 'Add full day (daily rate)')}
        </Text>
      </Pressable>
      {props.allDayHint ? (
        <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{props.allDayHint}</Text>
      ) : null}
      <Pressable
        testID="rental-request-add"
        accessibilityRole="button"
        accessibilityLabel={t('rentals.requestForm.add', 'Add')}
        disabled={props.addDisabled}
        onPress={props.onAdd}
        style={[
          styles.add,
          {
            borderColor: colors.primary.main,
            borderRadius: props.radius,
            opacity: props.addDisabled ? 0.45 : 1,
          },
        ]}
      >
        <Text style={{ color: colors.primary.main, fontWeight: '700' }}>
          {t('rentals.requestForm.add', 'Add')}
        </Text>
      </Pressable>
    </View>
  );
}

function TimeField({
  label,
  value,
  disabled,
  onPress,
  radius,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onPress: () => void;
  radius: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.time, { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: radius, opacity: disabled ? 0.7 : 1 }]}
    >
      <Text style={[styles.timeLabel, { color: colors.text.secondary }]}>{label}</Text>
      <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  chips: { gap: 6, paddingVertical: 2 },
  chip: {
    minWidth: 58,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  times: { flexDirection: 'row', gap: 8 },
  time: { flex: 1, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10, minHeight: 48 },
  timeLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  fullDay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  add: { height: 40, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
