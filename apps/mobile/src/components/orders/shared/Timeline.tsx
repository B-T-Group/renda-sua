import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { StatusPill } from '../../common/StatusPill';

export interface TimelineEntry {
  id: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  actorLabel?: string | null;
}

export interface TimelineProps {
  entries: TimelineEntry[];
  title?: string;
  emptyLabel?: string;
}

const DOT = 10;
const RAIL = 22;

export function Timeline({ entries, title, emptyLabel }: TimelineProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      <Text
        variant="titleMedium"
        style={{ fontWeight: '700', marginBottom: spacing.md }}
      >
        {title ?? t('orders.timeline.title', 'Timeline')}
      </Text>
      {entries.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {emptyLabel ?? t('orders.timeline.empty', 'No history yet')}
        </Text>
      ) : (
        entries.map((entry, index) => {
          const latest = index === 0;
          return (
            <View key={entry.id} style={styles.row}>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: latest
                        ? colors.primary.main
                        : colors.text.disabled,
                      borderColor: colors.surface,
                    },
                  ]}
                />
                {index < entries.length - 1 ? (
                  <View
                    style={[
                      styles.connector,
                      { backgroundColor: colors.divider },
                    ]}
                  />
                ) : null}
              </View>
              <View
                style={[
                  styles.body,
                  {
                    paddingBottom:
                      index < entries.length - 1 ? spacing.md : 0,
                  },
                ]}
              >
                <View style={[styles.chipRow, { gap: spacing.xs }]}>
                  <StatusPill
                    compact
                    label={t(
                      `common.orderStatus.${entry.status}`,
                      entry.status.replace(/_/g, ' ')
                    )}
                    backgroundColor={colors.pageBackground}
                    borderColor={colors.divider}
                    textColor={colors.text.primary}
                  />
                  <Text
                    variant="labelSmall"
                    style={{ color: colors.text.secondary, flex: 1 }}
                    numberOfLines={2}
                  >
                    {new Date(entry.createdAt).toLocaleString()}
                  </Text>
                </View>
                {entry.actorLabel ? (
                  <Text
                    variant="labelSmall"
                    style={{ color: colors.text.secondary, marginTop: 4 }}
                  >
                    {entry.actorLabel}
                  </Text>
                ) : null}
                {entry.notes ? (
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.text.primary, marginTop: 4 }}
                    numberOfLines={5}
                  >
                    {entry.notes}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
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
  body: { flex: 1, paddingLeft: 4, minWidth: 0 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 2,
  },
});
