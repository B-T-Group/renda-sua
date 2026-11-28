import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { ReserveSummary } from '../../utils/rentals/reserveSummary';
import { StickyActionCard } from '../common/StickyActionCard';
import { ReserveDetailsSheet } from './ReserveDetailsSheet';

/** Keeps amounts clear of the floating button that sits on the right edge above the bar. */
const AMOUNT_GUTTER = 32;

export interface ReserveStickyBarProps {
  /** Null for the legacy card-upfront flow, which has no pay-today / pay-at-pickup split. */
  summary: ReserveSummary | null;
  confirmLabel: string;
  confirmIcon?: string;
  loading?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

/** The reserve screen's one money summary: pay today, pay at pickup, key rule + Details, then the action. */
export function ReserveStickyBar({ summary, confirmLabel, confirmIcon, loading, onConfirm, onDismiss }: ReserveStickyBarProps) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <>
      <StickyActionCard
        testID="reserve-sticky"
        actionLabel={confirmLabel}
        actionIcon={confirmIcon}
        actionTestID="book-confirm-button"
        loading={loading}
        onAction={onConfirm}
        secondaryLabel={t('common.cancel', 'Cancel')}
        onSecondary={onDismiss}
        secondaryDisabled={loading}
      >
        {summary ? (
          <View testID="reserve-footer" style={styles.rows}>
            <AmountRow testID="reserve-footer-today" line={summary.footer.today} />
            <AmountRow testID="reserve-footer-pickup" line={summary.footer.pickup} />
            <DetailsRow line={summary.detailsLine} onPress={() => setDetailsOpen(true)} />
          </View>
        ) : null}
      </StickyActionCard>
      {summary ? <ReserveDetailsSheet visible={detailsOpen} summary={summary} onDismiss={() => setDetailsOpen(false)} /> : null}
    </>
  );
}

function AmountRow({ line, testID }: { line: ReserveSummary['footer']['today']; testID: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={styles.row}>
      <View style={styles.label}>
        <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{line.title}</Text>
        <Text style={{ color: colors.text.secondary, fontSize: 12 }} numberOfLines={1}>{line.sub}</Text>
      </View>
      <Text style={[styles.amount, { color: colors.text.primary }]}>{line.amount}</Text>
    </View>
  );
}

function DetailsRow({ line, onPress }: { line: string; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      testID="reserve-details-open"
      accessibilityRole="button"
      accessibilityLabel={t('rentals.reserve.detailsButton', 'Details')}
      onPress={onPress}
      style={styles.details}
    >
      <MaterialCommunityIcons name="information-outline" size={16} color={colors.primary.main} />
      <Text style={{ color: colors.text.secondary, fontSize: 12, marginLeft: 6, flex: 1 }} numberOfLines={2}>{line}</Text>
      <Text style={{ color: colors.primary.main, fontSize: 12, fontWeight: '700', marginLeft: 8 }}>
        {t('rentals.reserve.detailsButton', 'Details')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
  amount: { fontWeight: '800', fontSize: 18, marginLeft: 12, paddingRight: AMOUNT_GUTTER },
  details: { flexDirection: 'row', alignItems: 'center', paddingRight: AMOUNT_GUTTER },
});
