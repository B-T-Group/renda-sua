import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export interface BusinessExcitementStatsProps {
  clientCount: number | null;
  productViews: number | null;
  productViewsLast7d: number | null;
  loading: boolean;
  onClientsPress?: () => void;
}

/**
 * Compact dual-metric strip: clients (tappable) + product views.
 */
export function BusinessExcitementStats({
  clientCount,
  productViews,
  productViewsLast7d,
  loading,
  onClientsPress,
}: BusinessExcitementStatsProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const clientsLoading = loading && clientCount == null;
  const viewsLoading = loading && productViews == null;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      <MetricCell
        icon="account-group-outline"
        iconBg={colors.primary.main}
        iconColor={colors.primary.contrast}
        label={t('business.dashboard.clientsSoFar.label', 'Clients')}
        value={clientCount}
        loading={clientsLoading}
        hint={clientHint(t, clientCount, clientsLoading, !!onClientsPress)}
        onPress={onClientsPress}
        a11yLabel={t(
          'business.dashboard.clientsSoFar.a11y',
          'Clients. Open city word cloud.'
        )}
        showChevron={!!onClientsPress}
      />
      <View style={[styles.divider, { backgroundColor: colors.divider }]} />
      <MetricCell
        icon="eye-outline"
        iconBg={colors.secondary.main}
        iconColor={colors.secondary.contrast}
        label={t('business.dashboard.productViews.label', 'Views')}
        value={productViews}
        loading={viewsLoading}
        hint={viewsHint(t, productViews, productViewsLast7d, viewsLoading)}
      />
    </View>
  );
}

function clientHint(
  t: (key: string, fallback: string) => string,
  count: number | null,
  loading: boolean,
  clickable: boolean
): string {
  if (loading) return '';
  if (count == null) {
    return t(
      'business.dashboard.clientsSoFar.unavailableHint',
      'Client count unavailable right now'
    );
  }
  if (count === 0) {
    return t(
      'business.dashboard.clientsSoFar.emptyHint',
      'Customers who order or rent will show up here.'
    );
  }
  return clickable
    ? t(
        'business.dashboard.clientsSoFar.hintClickShort',
        'Tap for cities'
      )
    : t(
        'business.dashboard.clientsSoFar.hint',
        'Unique people who have ordered or rented from you.'
      );
}

function viewsHint(
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string,
  count: number | null,
  last7d: number | null,
  loading: boolean
): string {
  if (loading) return '';
  if (count == null) {
    return t(
      'business.dashboard.productViews.unavailableHint',
      'Views unavailable right now'
    );
  }
  if (count === 0) {
    return t(
      'business.dashboard.productViews.emptyHintShort',
      'Share to get views'
    );
  }
  if (typeof last7d === 'number' && last7d > 0) {
    return t('business.dashboard.productViews.weekDelta', '+{{count}} this week', {
      count: last7d,
    });
  }
  return t('business.dashboard.productViews.hintShort', 'Unique product viewers');
}

interface MetricCellProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconBg: string;
  iconColor: string;
  label: string;
  value: number | null;
  loading: boolean;
  hint: string;
  onPress?: () => void;
  a11yLabel?: string;
  showChevron?: boolean;
}

function MetricCell({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  loading,
  hint,
  onPress,
  a11yLabel,
  showChevron,
}: MetricCellProps) {
  const { colors, spacing } = useTheme();
  const isUnknown = !loading && value == null;

  const body = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.textCol}>
        <Text
          variant="labelSmall"
          numberOfLines={1}
          style={{ color: colors.text.secondary, letterSpacing: 0.3 }}
        >
          {label}
        </Text>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.primary.main}
            style={{ alignSelf: 'flex-start', marginVertical: 4 }}
          />
        ) : (
          <Text
            variant="headlineSmall"
            style={{ color: colors.text.primary, fontWeight: '700', marginTop: 2 }}
          >
            {isUnknown ? '—' : (value as number).toLocaleString()}
          </Text>
        )}
        {hint ? (
          <Text
            variant="bodySmall"
            numberOfLines={2}
            style={{ color: colors.text.secondary, marginTop: 2 }}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      {showChevron ? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={colors.text.secondary}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.cell, { padding: spacing.md }]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={({ pressed }) => [
        styles.cell,
        { padding: spacing.md, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  cell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: { flex: 1, minWidth: 0 },
});
