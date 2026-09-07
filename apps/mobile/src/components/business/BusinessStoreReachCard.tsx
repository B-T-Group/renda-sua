import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import { SkeletonBone } from '../common/SkeletonBone';
import {
  PauseOrdersDialog,
  type PauseDuration,
} from '../dialogs/PauseOrdersDialog';
import { businessApi } from '../../services/businessApi';
import { StorefrontPinIllustration } from '../illustrations/StorefrontPinIllustration';

export interface BusinessStoreReachCardProps {
  productViews: number | null;
  metricsLoading?: boolean;
  compact?: boolean;
  onShare: () => void;
  onPreview: () => void;
  onOpenInsights?: () => void;
}

export function BusinessStoreReachCard({
  productViews,
  metricsLoading = false,
  compact = false,
  onShare,
  onPreview,
  onOpenInsights,
}: BusinessStoreReachCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [accepting, setAccepting] = useState(true);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [pausing, setPausing] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await businessApi.orders.getReliability();
      setAccepting(data.accepting_orders !== false);
      setPausedUntil(data.paused_until);
    } catch {
      // keep last known values
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshStatus();
    }, [refreshStatus])
  );

  const onResume = useCallback(async () => {
    setResuming(true);
    try {
      await businessApi.orders.resumeAvailability();
      setAccepting(true);
      setPausedUntil(null);
      await refreshStatus();
    } finally {
      setResuming(false);
    }
  }, [refreshStatus]);

  const onSelectPauseDuration = useCallback(
    async (duration: PauseDuration) => {
      setPausing(true);
      try {
        await businessApi.orders.pauseAvailability(duration);
        setAccepting(false);
        setPauseDialogOpen(false);
        await refreshStatus();
      } finally {
        setPausing(false);
      }
    },
    [refreshStatus]
  );

  const pillBg = accepting
    ? `${colors.success.main}24`
    : `${colors.warning.main}24`;
  const pillFg = accepting ? colors.success.dark : colors.warning.dark;
  const viewsZero = !metricsLoading && (productViews ?? 0) === 0;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: accepting ? colors.divider : colors.warning.main,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          marginBottom: spacing.md,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      {!compact ? (
        <View style={styles.illustrationWrap}>
          <StorefrontPinIllustration size={96} />
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text variant="titleSmall" style={{ color: colors.text.primary }}>
            {t('business.quietHome.reach.title', 'Store reach')}
          </Text>
          <View style={styles.statusRow}>
            {statusLoading ? (
              <SkeletonBone height={22} width={110} borderRadius={999} />
            ) : (
              <StatusPill
                label={
                  accepting
                    ? t('businessAvailability.open', 'Accepting orders')
                    : t('businessAvailability.paused', 'Not accepting orders')
                }
                backgroundColor={pillBg}
                textColor={pillFg}
                compact
              />
            )}
          </View>
          {!accepting && pausedUntil ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t('business.insights.summary.pausedUntil', 'Until {{time}}', {
                time: formatPausedUntil(pausedUntil),
              })}
            </Text>
          ) : null}
        </View>
        {onOpenInsights ? (
          <Pressable
            onPress={onOpenInsights}
            accessibilityRole="button"
            accessibilityLabel={t(
              'business.quietHome.reach.insightsA11y',
              'Open store insights'
            )}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={colors.text.secondary}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.viewsRow}>
        <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
          {t('business.dashboard.productViews.label', 'Views')}
        </Text>
        {metricsLoading && productViews == null ? (
          <SkeletonBone height={22} width={48} style={{ marginTop: 4 }} />
        ) : (
          <Text variant="titleMedium" style={{ color: colors.text.primary }}>
            {productViews == null ? '—' : formatCompact(productViews)}
          </Text>
        )}
        {viewsZero ? (
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t(
              'business.quietHome.reach.zeroViewsHint',
              'Share your shop so customers can find you.'
            )}
          </Text>
        ) : null}
      </View>

      <Button mode="contained" icon="share-variant" onPress={onShare}>
        {t('business.quietHome.reach.shareCta', 'Share store')}
      </Button>
      <View style={styles.actionsRow}>
        <Button mode="text" compact onPress={onPreview}>
          {t('stores.previewCtaButton', 'Preview store')}
        </Button>
        {accepting ? (
          <Button
            mode="text"
            compact
            onPress={() => setPauseDialogOpen(true)}
          >
            {t('business.insights.summary.pauseCta', 'Pause orders')}
          </Button>
        ) : (
          <Button
            mode="outlined"
            compact
            loading={resuming}
            disabled={resuming}
            onPress={() => void onResume()}
          >
            {t('businessAvailability.resume', 'Resume orders')}
          </Button>
        )}
      </View>

      <PauseOrdersDialog
        visible={pauseDialogOpen}
        loading={pausing}
        onDismiss={() => {
          if (!pausing) setPauseDialogOpen(false);
        }}
        onSelectDuration={(duration) => void onSelectPauseDuration(duration)}
      />
    </View>
  );
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function formatPausedUntil(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  illustrationWrap: { alignItems: 'center', marginBottom: 4 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerText: { flex: 1, minWidth: 0, gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  viewsRow: { gap: 2 },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
});
