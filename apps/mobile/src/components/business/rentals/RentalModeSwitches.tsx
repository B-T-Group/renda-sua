import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Switch, Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';

export interface RentalModes {
  offersDaily: boolean;
  offersHourly: boolean;
}

/**
 * "Rent by the day" / "Rent by the hour" (rentals_day_hours_picker_enabled).
 * At least one stays on: switching off the last one is refused with "Keep at least one on." in red.
 */
export function RentalModeSwitches({
  value,
  onChange,
  testID = 'rental-mode-switches',
}: {
  value: RentalModes;
  onChange: (next: RentalModes) => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const [refused, setRefused] = useState(false);
  const row = (
    key: keyof RentalModes,
    icon: 'white-balance-sunny' | 'clock-outline',
    label: string,
    hint: string
  ) => {
    const on = value[key];
    const other = key === 'offersDaily' ? value.offersHourly : value.offersDaily;
    return (
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.primaryTint, borderRadius: borderRadius.sm }]}>
          <MaterialCommunityIcons name={icon} size={18} color={colors.primary.main} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
          <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{hint}</Text>
        </View>
        <Switch
          testID={`${testID}-${key}`}
          value={on}
          color={colors.primary.main}
          onValueChange={(next) => {
            if (!next && !other) {
              setRefused(true);
              return;
            }
            setRefused(false);
            onChange({ ...value, [key]: next });
          }}
        />
      </View>
    );
  };
  return (
    <View testID={testID} style={[styles.card, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
      {row(
        'offersDaily',
        'white-balance-sunny',
        t('business.rentals.rentBy.byDay', 'Rent by the day'),
        t('business.rentals.rentBy.byDayHint', 'Renters can book a full day.')
      )}
      {row(
        'offersHourly',
        'clock-outline',
        t('business.rentals.rentBy.byHour', 'Rent by the hour'),
        t('business.rentals.rentBy.byHourHint', 'Renters can book a few hours.')
      )}
      <View testID={`${testID}-hint`} style={styles.hint}>
        <MaterialCommunityIcons
          name={refused ? 'alert-circle-outline' : 'information-outline'}
          size={15}
          color={refused ? colors.error.main : colors.text.secondary}
        />
        <Text style={{ color: refused ? colors.error.main : colors.text.secondary, fontSize: 12, fontWeight: refused ? '700' : '400', flex: 1 }}>
          {t('business.rentals.rentBy.atLeastOne', 'Keep at least one on.')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 12, gap: 10, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  label: { fontSize: 15, fontWeight: '700' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
