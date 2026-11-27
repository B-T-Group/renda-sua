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

const LINE_ICONS = {
  check: 'check',
  refund: 'restore',
  warn: 'alert-outline',
  card: 'credit-card-outline',
} as const;

/** Approved 01a/01b body: icon rows, the fee (or nothing-to-pay) box, and the free-cancellation line. */
export function ReserveSummaryView({ summary, itemName, business }: { summary: ReserveSummary; itemName: string; business?: string | null }) {
  const { colors, spacing, borderRadius } = useTheme();
  const box = summary.box;
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
      <View
        testID={box.kind === 'fee' ? 'book-confirm-fee-rules' : 'book-confirm-nothing-today'}
        style={[
          styles.card,
          {
            borderRadius: borderRadius.md,
            padding: spacing.sm,
            gap: 6,
            backgroundColor: box.kind === 'fee' ? colors.primaryTint : colors.surface,
            borderColor: box.kind === 'fee' ? colors.primarySubtle : colors.divider,
            borderLeftWidth: box.kind === 'free' ? 4 : StyleSheet.hairlineWidth,
            borderLeftColor: box.kind === 'free' ? colors.primary.main : colors.primarySubtle,
          },
        ]}
      >
        <View style={styles.row}>
          <MaterialCommunityIcons name={box.kind === 'fee' ? 'credit-card-outline' : 'wallet-outline'} size={20} color={colors.primary.main} />
          <Text style={{ color: box.kind === 'fee' ? colors.primary.main : colors.text.primary, fontWeight: '800', marginLeft: 8, flex: 1 }}>{box.title}</Text>
        </View>
        {box.lines.map((line, i) => (
          <View key={i} style={[styles.row, { alignItems: 'flex-start' }]}>
            <MaterialCommunityIcons
              name={LINE_ICONS[line.icon]}
              size={16}
              color={line.warn ? colors.warning.dark : colors.text.secondary}
              style={{ marginTop: 2 }}
            />
            <Text style={{ color: line.warn ? colors.warning.dark : colors.text.primary, marginLeft: 8, flex: 1, fontSize: 13 }}>{line.text}</Text>
          </View>
        ))}
      </View>
      {summary.cancelLine ? (
        <View style={[styles.row, { backgroundColor: colors.primaryTint, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 8 }]}>
          <MaterialCommunityIcons name="check" size={16} color={colors.primary.main} />
          <Text style={{ color: colors.text.secondary, marginLeft: 8, flex: 1, fontSize: 13 }}>{summary.cancelLine}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** "Pay today" and "Pay at pickup" amounts, one labelled line each, above the actions. */
export function ReserveFooter({ summary }: { summary: ReserveSummary }) {
  const { colors } = useTheme();
  const lines = [
    { key: 'today', line: summary.footer.today },
    { key: 'pickup', line: summary.footer.pickup },
  ];
  return (
    <View testID="reserve-footer" style={{ gap: 8 }}>
      {lines.map(({ key, line }) => (
        <View key={key} style={styles.row} testID={`reserve-footer-${key}`}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{line.title}</Text>
            <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{line.sub}</Text>
          </View>
          <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 18, marginLeft: 12 }}>{line.amount}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
});
