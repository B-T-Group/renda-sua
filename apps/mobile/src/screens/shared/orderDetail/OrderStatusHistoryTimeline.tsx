import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import { StatusPill } from '../../../components/common/StatusPill';
import type { Order } from '../../../types/agent';

type HistoryEntry = NonNullable<Order['order_status_history']>[number];

function formatWhen(locale: string, iso: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

function actorName(entry: HistoryEntry): string | null {
  const u = entry.changed_by_user;
  if (!u) return null;
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return n || null;
}

type Props = {
  entries: HistoryEntry[];
  locale: string;
};

const DOT = 10;
const RAIL = 22;

export function OrderStatusHistoryTimeline({ entries, locale }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [entries]
  );

  return (
    <View style={{ paddingTop: spacing.xs, paddingHorizontal: spacing.xxs }}>
      {sorted.map((h, idx) => {
        const latest = idx === 0;
        const actor = actorName(h);
        return (
          <View key={h.id} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: latest ? colors.primary.main : colors.text.disabled,
                    borderColor: colors.surface,
                  },
                ]}
              />
              {idx < sorted.length - 1 ? (
                <View style={[styles.connector, { backgroundColor: colors.divider }]} />
              ) : null}
            </View>
            <View style={[styles.body, { paddingBottom: idx < sorted.length - 1 ? spacing.md : 0 }]}>
              <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
                {formatWhen(locale, h.created_at)}
              </Text>
              <View style={styles.chipRow}>
                <StatusPill
                  compact
                  label={t(`common.orderStatus.${h.status}`, h.status)}
                  backgroundColor={colors.pageBackground}
                  borderColor={colors.divider}
                  textColor={colors.text.primary}
                />
                {h.previous_status ? (
                  <Text variant="bodySmall" style={{ color: colors.text.secondary, flex: 1 }} numberOfLines={2}>
                    {t('orders.clientManage.historyFrom', 'From')}{' '}
                    {t(`common.orderStatus.${h.previous_status}`, h.previous_status)}
                  </Text>
                ) : null}
              </View>
              {h.notes ? (
                <Text variant="bodySmall" style={{ color: colors.text.primary, marginTop: 4 }} numberOfLines={5}>
                  {h.notes}
                </Text>
              ) : null}
              {actor ? (
                <Text variant="labelSmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
                  {t('orders.clientManage.historyBy', 'Updated by {{name}}', { name: actor })}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: RAIL, alignItems: 'center', flexDirection: 'column' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    marginTop: 2,
    borderWidth: 2,
  },
  connector: { width: 2, flex: 1, minHeight: 8, marginTop: 2 },
  body: { flex: 1, paddingLeft: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
});
