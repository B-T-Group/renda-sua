import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { agentApi } from '../../services/agentApi';
import type { PendingWithdrawalRow } from '../../types/accountWallet';

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Hermes omits `Intl.RelativeTimeFormat` on many RN builds — do not use it.
 * Format with i18n instead (same pattern as active-order "received X ago").
 */
function relativeTime(iso: string, t: TFunction): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) {
    return t('accounts.pendingWithdrawals.minutesAgo', '{{count}} min ago', {
      count: minutes,
    });
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return t('accounts.pendingWithdrawals.hoursAgo', '{{count}}h ago', {
      count: hours,
    });
  }
  const days = Math.round(hours / 24);
  return t('accounts.pendingWithdrawals.daysAgo', '{{count}}d ago', {
    count: days,
  });
}

const COLLAPSED_VISIBLE = 2;

export interface PendingWithdrawalsSectionProps {
  items: PendingWithdrawalRow[];
  onResolved: (message: string) => void;
  compact?: boolean;
}

export function PendingWithdrawalsSection({
  items,
  onResolved,
  compact = false,
}: PendingWithdrawalsSectionProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleResolve = useCallback(
    async (id: string) => {
      if (busyId) return;
      setBusyId(id);
      try {
        const res = await agentApi.mobilePayments.resolveWithdrawal(id);
        const message =
          res.message?.trim() ||
          t(
            'accounts.pendingWithdrawals.resolveDone',
            'Withdrawal status updated.'
          );
        onResolved(message);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : t(
                'accounts.pendingWithdrawals.resolveFailed',
                'Could not resolve this withdrawal. Try again.'
              );
        onResolved(message);
      } finally {
        setBusyId(null);
      }
    },
    [busyId, onResolved, t]
  );

  if (!items.length) return null;

  const canCollapse = items.length > COLLAPSED_VISIBLE;
  const visibleItems =
    canCollapse && !expanded ? items.slice(0, COLLAPSED_VISIBLE) : items;
  const hiddenCount = items.length - COLLAPSED_VISIBLE;

  return (
    <View
      style={[
        styles.wrap,
        {
          marginTop: compact ? spacing.sm : spacing.md,
          padding: spacing.sm,
          borderRadius: borderRadius.md,
          backgroundColor: colors.warning.main + '14',
          borderColor: colors.warning.main + '55',
        },
      ]}
    >
      <Text
        style={[
          typography.caption,
          { color: colors.warning.main, fontWeight: '700', marginBottom: 4 },
        ]}
      >
        {t('accounts.pendingWithdrawals.title', 'Pending withdrawals')}
        {items.length > 1
          ? ` (${items.length})`
          : ''}
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.secondary, marginBottom: spacing.sm },
        ]}
      >
        {t(
          'accounts.pendingWithdrawals.hint',
          'Resolve these before starting a new withdrawal. Tap Resolve to check Mobile Money or cancel a stuck request.'
        )}
      </Text>
      {visibleItems.map((item) => {
        const busy = busyId === item.id;
        return (
          <View
            key={item.id}
            style={[
              styles.row,
              {
                borderColor: colors.divider,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.sm,
                padding: spacing.sm,
                marginBottom: spacing.xs,
              },
            ]}
          >
            <View style={styles.meta}>
              <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
                {formatAmount(item.amount, item.currency)}
              </Text>
              <Text style={[typography.caption, { color: colors.text.secondary }]}>
                {[item.customer_phone, relativeTime(item.created_at, t)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Pressable
              onPress={() => void handleResolve(item.id)}
              disabled={!!busyId}
              accessibilityRole="button"
              accessibilityLabel={t(
                'accounts.pendingWithdrawals.resolve',
                'Resolve pending withdrawal'
              )}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.primary.main,
                  opacity: busyId && !busy ? 0.45 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.primary.contrast} />
              ) : (
                <MaterialCommunityIcons
                  name="playlist-check"
                  size={20}
                  color={colors.primary.contrast}
                />
              )}
            </Pressable>
          </View>
        );
      })}
      {canCollapse ? (
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={
            expanded
              ? t('accounts.pendingWithdrawals.showLess', 'Show less')
              : t('accounts.pendingWithdrawals.showMore', 'Show {{count}} more', {
                  count: hiddenCount,
                })
          }
          style={({ pressed }) => [
            styles.expandBtn,
            { opacity: pressed ? 0.7 : 1, marginTop: spacing.xs },
          ]}
        >
          <Text
            style={[
              typography.caption,
              { color: colors.primary.main, fontWeight: '700' },
            ]}
          >
            {expanded
              ? t('accounts.pendingWithdrawals.showLess', 'Show less')
              : t('accounts.pendingWithdrawals.showMore', 'Show {{count}} more', {
                  count: hiddenCount,
                })}
          </Text>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.primary.main}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  meta: { flex: 1, minWidth: 0 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
});
