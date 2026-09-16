import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  Chip,
  Snackbar,
  Switch,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmActionDialog } from '@/components/dialogs/ConfirmActionDialog';
import { useTheme } from '@/contexts/ThemeContext';
import { useMerchantReels } from '@/hooks/business/useMerchantReels';
import type { BusinessRootStackParamList } from '@/navigation/types';
import type { MerchantReel } from '@/services/merchantReelsApi';

type FilterId = 'all' | 'pending' | 'failed' | 'live' | 'inactive';

const PENDING_PROCESSING = new Set([
  'generating',
  'queued',
  'processing',
  'awaiting_upload',
]);

export default function BusinessMyReelsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const { reels, loading, refreshing, mutatingId, error, load, setActive, retry } =
    useMerchantReels();
  const [filter, setFilter] = useState<FilterId>('all');
  const [snack, setSnack] = useState<string | null>(null);
  const [hideTarget, setHideTarget] = useState<MerchantReel | null>(null);

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      if (error) setSnack(error);
    }, [error])
  );

  const filtered = useMemo(
    () => reels.filter((reel) => matchesFilter(reel, filter)),
    [reels, filter]
  );

  const onRetry = useCallback(
    async (reelId: string) => {
      try {
        await retry(reelId);
        setSnack(t('business.reels.mine.retryQueued', 'Retry queued'));
      } catch (err: unknown) {
        setSnack(
          err instanceof Error
            ? err.message
            : t('business.reels.mine.retryError', 'Could not retry reel')
        );
      }
    },
    [retry, t]
  );

  const onToggleActive = useCallback(
    async (reel: MerchantReel, next: boolean) => {
      if (!next) {
        setHideTarget(reel);
        return;
      }
      try {
        await setActive(reel.id, true);
        setSnack(t('business.reels.mine.shown', 'Reel is visible in Reels again'));
      } catch (err: unknown) {
        setSnack(
          err instanceof Error
            ? err.message
            : t('business.reels.mine.activeError', 'Could not update reel visibility')
        );
      }
    },
    [setActive, t]
  );

  const confirmHide = useCallback(async () => {
    if (!hideTarget) return;
    const id = hideTarget.id;
    setHideTarget(null);
    try {
      await setActive(id, false);
      setSnack(t('business.reels.mine.hidden', 'Reel hidden from Reels'));
    } catch (err: unknown) {
      setSnack(
        err instanceof Error
          ? err.message
          : t('business.reels.mine.activeError', 'Could not update reel visibility')
      );
    }
  }, [hideTarget, setActive, t]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <View style={[styles.filters, { paddingHorizontal: spacing.md }]}>
        {(
          [
            ['all', t('business.reels.mine.filterAll', 'All')],
            ['pending', t('business.reels.mine.filterPending', 'In progress')],
            ['failed', t('business.reels.mine.filterFailed', 'Failed')],
            ['live', t('business.reels.mine.filterLive', 'Live')],
            ['inactive', t('business.reels.mine.filterInactive', 'Inactive')],
          ] as const
        ).map(([id, label]) => (
          <Chip
            key={id}
            selected={filter === id}
            onPress={() => setFilter(id)}
            style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
          >
            {label}
          </Chip>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.lg,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh')}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text
              style={[
                typography.subtitle1,
                { color: colors.text.primary, textAlign: 'center' },
              ]}
            >
              {t('business.reels.mine.emptyTitle', 'No reels here yet')}
            </Text>
            <Text
              style={[
                typography.body2,
                {
                  color: colors.text.secondary,
                  textAlign: 'center',
                  marginTop: spacing.xs,
                },
              ]}
            >
              {t(
                'business.reels.mine.emptyBody',
                'Create an AI or uploaded reel to reach shoppers in the Reels feed.'
              )}
            </Text>
            <Button
              mode="contained"
              icon="plus"
              style={{ marginTop: spacing.md }}
              onPress={() => navigation.navigate('BusinessAddReel', {})}
            >
              {t('business.reels.addFab', 'Add reel')}
            </Button>
          </View>
        }
        renderItem={({ item }) => (
          <ReelRowCard
            reel={item}
            mutating={mutatingId === item.id}
            onRetry={() => void onRetry(item.id)}
            onToggleActive={(next) => void onToggleActive(item, next)}
            colors={colors}
            spacing={spacing}
            typography={typography}
            borderRadius={borderRadius}
            t={t}
          />
        )}
      />

      <ConfirmActionDialog
        visible={!!hideTarget}
        title={t('business.reels.mine.hideTitle', 'Hide from Reels?')}
        message={t(
          'business.reels.mine.hideBody',
          'Shoppers will no longer see this reel in the feed. You can show it again anytime.'
        )}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('business.reels.mine.hideConfirm', 'Hide')}
        destructive
        loading={mutatingId === hideTarget?.id}
        onDismiss={() => setHideTarget(null)}
        onConfirm={() => void confirmHide()}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3500}>
        {snack}
      </Snackbar>
    </View>
  );
}

function isLiveCapable(reel: MerchantReel): boolean {
  return (
    reel.processing_status === 'ready' && reel.moderation_status === 'approved'
  );
}

function isLiveVisible(reel: MerchantReel): boolean {
  return isLiveCapable(reel) && reel.is_active !== false;
}

function matchesFilter(reel: MerchantReel, filter: FilterId): boolean {
  if (filter === 'all') return true;
  if (filter === 'failed') return reel.processing_status === 'failed';
  if (filter === 'live') return isLiveVisible(reel);
  if (filter === 'inactive') {
    return isLiveCapable(reel) && reel.is_active === false;
  }
  if (reel.processing_status === 'failed' || isLiveCapable(reel)) return false;
  return (
    PENDING_PROCESSING.has(reel.processing_status) ||
    ['pending', 'ai_reviewing', 'draft'].includes(reel.moderation_status)
  );
}

function statusLabel(
  reel: MerchantReel,
  t: (key: string, fallback: string) => string
): string {
  if (reel.processing_status === 'failed') {
    return t('business.reels.mine.statusFailed', 'Failed');
  }
  if (isLiveCapable(reel)) {
    return reel.is_active === false
      ? t('business.reels.mine.statusHidden', 'Hidden')
      : t('business.reels.mine.statusLive', 'Live');
  }
  if (PENDING_PROCESSING.has(reel.processing_status)) {
    return t('business.reels.mine.statusProcessing', 'Processing');
  }
  if (
    reel.moderation_status === 'pending' ||
    reel.moderation_status === 'ai_reviewing'
  ) {
    return t('business.reels.mine.statusPendingReview', 'Pending review');
  }
  return reel.processing_status || reel.moderation_status;
}

function ReelRowCard(props: {
  reel: MerchantReel;
  mutating: boolean;
  onRetry: () => void;
  onToggleActive: (next: boolean) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  typography: ReturnType<typeof useTheme>['typography'];
  borderRadius: ReturnType<typeof useTheme>['borderRadius'];
  t: (key: string, fallback: string) => string;
}) {
  const {
    reel,
    mutating,
    onRetry,
    onToggleActive,
    colors,
    spacing,
    typography,
    borderRadius,
    t,
  } = props;
  const failed = reel.processing_status === 'failed';
  const liveCapable = isLiveCapable(reel);
  const active = reel.is_active !== false;

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={styles.row}>
        {reel.thumbnail_url ? (
          <Image source={{ uri: reel.thumbnail_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.divider }]} />
        )}
        <View style={styles.meta}>
          <Text
            numberOfLines={1}
            style={[typography.subtitle2, { color: colors.text.primary }]}
          >
            {reel.subject_title ||
              (reel.generation_source === 'ai'
                ? t('business.reels.mine.sourceAi', 'AI ad')
                : t('business.reels.mine.sourceUpload', 'Upload'))}
          </Text>
          <View style={styles.badgeRow}>
            <Chip compact style={styles.badge}>
              {statusLabel(reel, t)}
            </Chip>
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {reel.generation_source === 'ai'
                ? t('business.reels.mine.sourceAi', 'AI ad')
                : t('business.reels.mine.sourceUpload', 'Upload')}
            </Text>
          </View>
          {reel.caption ? (
            <Text
              numberOfLines={2}
              style={[typography.body2, { color: colors.text.secondary }]}
            >
              {reel.caption}
            </Text>
          ) : null}
        </View>
      </View>
      {failed && reel.processing_error ? (
        <Text
          style={[
            typography.caption,
            { color: '#b00020', marginTop: spacing.xs },
          ]}
        >
          {reel.processing_error}
        </Text>
      ) : null}
      {failed ? (
        <Button
          mode="contained"
          loading={mutating}
          disabled={mutating}
          onPress={onRetry}
          style={{ marginTop: spacing.sm }}
        >
          {t('business.reels.mine.retry', 'Retry')}
        </Button>
      ) : null}
      {liveCapable ? (
        <View style={[styles.toggleRow, { marginTop: spacing.sm }]}>
          <Text style={[typography.body2, { color: colors.text.primary, flex: 1 }]}>
            {active
              ? t('business.reels.mine.showOnFeed', 'Visible in Reels')
              : t('business.reels.mine.hiddenFromFeed', 'Hidden from Reels')}
          </Text>
          <Switch
            value={active}
            disabled={mutating}
            onValueChange={onToggleActive}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 8 },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  card: { borderWidth: 1 },
  row: { flexDirection: 'row' },
  thumb: { width: 72, height: 108, borderRadius: 10 },
  meta: { flex: 1, marginLeft: 12, justifyContent: 'center', gap: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { height: 28 },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
});
