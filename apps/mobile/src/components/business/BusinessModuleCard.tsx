import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Text, Badge } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { PERSONA_ACCENT } from '../../constants/personaTheme';

export interface BusinessModuleCardModel {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  count: number | null;
  accentColor?: string;
  showBadge?: boolean;
  orderCountByStatus?: Record<string, number>;
  onPress: () => void;
}

interface Props {
  module: BusinessModuleCardModel;
  loading?: boolean;
}

export function BusinessModuleCard({ module: m, loading }: Props) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const accent = m.accentColor ?? PERSONA_ACCENT.business;
  const getStatusBackground = (status: string) => {
    if (status === 'pending') return colors.warning.light + '24';
    if (['complete', 'delivered'].includes(status)) return colors.success.light + '24';
    if (['confirmed', 'preparing'].includes(status)) return colors.info.light + '24';
    if (['ready_for_pickup', 'assigned_to_agent'].includes(status)) return colors.primary.light + '18';
    return colors.pageBackground;
  };

  return (
    <Pressable
      onPress={m.onPress}
      disabled={loading}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1, marginBottom: 12 }]}
    >
      <Card
        mode="elevated"
        style={[
          styles.card,
          {
            borderRadius: borderRadius.lg,
            borderLeftWidth: 4,
            borderLeftColor: accent,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Card.Content>
          <View style={styles.headerRow}>
            <MaterialCommunityIcons name={m.icon} size={36} color={accent} />
            <View style={styles.titleCol}>
              <Text variant="titleMedium" style={{ color: colors.text.primary }}>
                {m.title}
              </Text>
              {m.showBadge && m.count != null && m.count > 0 ? (
                <Badge style={styles.badge}>{m.count}</Badge>
              ) : null}
            </View>
            {m.count != null && !m.showBadge ? (
              <Text variant="headlineSmall" style={{ color: accent, fontWeight: '700' }}>
                {loading ? '—' : m.count}
              </Text>
            ) : null}
          </View>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: 8 }}>
            {m.description}
          </Text>
          {m.orderCountByStatus && Object.keys(m.orderCountByStatus).length > 0 ? (
            <View style={styles.statusRow}>
              {Object.entries(m.orderCountByStatus)
                .filter(([, n]) => n > 0)
                .slice(0, 6)
                .map(([status, n]) => (
                  <View
                    key={status}
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: getStatusBackground(status),
                        borderRadius: borderRadius.sm,
                      },
                    ]}
                  >
                    <Text style={[typography.caption, { color: colors.text.primary }]}>
                      {t(`common.orderStatus.${status}`, status.replace(/_/g, ' '))}: {n}
                    </Text>
                  </View>
                ))}
            </View>
          ) : null}
        </Card.Content>
        <Card.Actions>
          <Text variant="labelLarge" style={{ color: colors.primary.main, marginLeft: 8 }}>
            {t('common.manage', 'Manage')}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary.main} />
        </Card.Actions>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleCol: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  badge: { alignSelf: 'flex-start' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 4 },
});
