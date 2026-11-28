import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { ReserveIcon, ReserveSummary } from '../../utils/rentals/reserveSummary';

const ROW_ICONS: Record<ReserveIcon, keyof typeof MaterialCommunityIcons.glyphMap> = {
  calendar: 'calendar-blank-outline',
  clock: 'clock-outline',
  shield: 'shield-outline',
  pin: 'map-marker-outline',
  camera: 'camera-outline',
  timer: 'timer-sand',
  refund: 'restore',
};

/** Approved 01a/01b body: the item and its icon rows. Money rules live in the sticky footer. */
export function ReserveSummaryView({ summary, itemName, business }: { summary: ReserveSummary; itemName: string; business?: string | null }) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View style={{ gap: spacing.sm }} testID="reserve-summary">
      <View style={[styles.card, { borderColor: colors.divider, borderRadius: borderRadius.md, padding: spacing.sm }]}>
        <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 16 }}>{itemName}</Text>
        {business ? <Text style={{ color: colors.text.secondary, fontSize: 13 }}>{business}</Text> : null}
      </View>
      <View style={[styles.card, { borderColor: colors.divider, borderRadius: borderRadius.md }]}>
        {summary.rows.map((row, i) => (
          <View
            key={row.key}
            testID={`reserve-row-${row.key}`}
            style={{ paddingHorizontal: spacing.sm, paddingVertical: 10, borderTopColor: colors.divider, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }}
          >
            <View style={styles.row}>
              <MaterialCommunityIcons name={ROW_ICONS[row.icon]} size={18} color={colors.text.secondary} />
              <Text style={{ color: colors.text.secondary, marginLeft: 8, flexShrink: 0, maxWidth: '40%' }}>{row.label}</Text>
              {row.stacked ? null : (
                <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: 8 }}>
                  <Text style={{ color: colors.text.primary, fontWeight: '700', textAlign: 'right' }}>{row.value}</Text>
                  {row.sub ? <Text style={{ color: colors.text.secondary, fontSize: 12, textAlign: 'right' }}>{row.sub}</Text> : null}
                </View>
              )}
            </View>
            {row.stacked ? (
              <Text style={{ color: colors.text.primary, fontWeight: '700', marginTop: 4, marginLeft: 26 }}>{row.value}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
});
