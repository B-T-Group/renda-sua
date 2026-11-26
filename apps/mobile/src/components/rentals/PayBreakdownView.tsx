import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { PayBreakdown } from '../../utils/rentals/payBreakdown';

const ICONS = {
  clock: 'clock-outline',
  check: 'check',
  card: 'credit-card-outline',
  momo: 'cellphone',
  wallet: 'wallet-outline',
  shield: 'shield-outline',
} as const;

/** Approved 05a/05b rows: rental, reservation fee paid, charged / to pay now, deposit hold. */
export function PayBreakdownView({ breakdown }: { breakdown: PayBreakdown }) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View testID="pay-breakdown" style={[styles.box, { borderColor: colors.divider, borderRadius: borderRadius.md }]}>
      {breakdown.rows.map((row, i) => (
        <View
          key={row.key}
          testID={`pay-breakdown-${row.key}`}
          style={[styles.row, { paddingHorizontal: spacing.sm, paddingVertical: 10, borderTopColor: colors.divider, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}
        >
          <MaterialCommunityIcons name={ICONS[row.icon]} size={18} color={colors.text.secondary} />
          <Text style={{ color: colors.text.secondary, marginLeft: 8, flex: 1 }}>{row.label}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.text.primary, fontWeight: row.strong ? '800' : '700' }}>{row.value}</Text>
            {row.sub ? <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{row.sub}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export function PayFooter({ breakdown }: { breakdown: PayBreakdown }) {
  const { colors } = useTheme();
  if (!breakdown.footer) return null;
  return (
    <Text testID="pay-breakdown-footer" style={{ color: colors.text.secondary, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
      {breakdown.footer}
    </Text>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
