import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  IconButton,
  Snackbar,
  Switch,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmActionDialog } from '@/components/dialogs/ConfirmActionDialog';
import { StatusPill } from '@/components/common/StatusPill';
import { ReelPlayer } from '@/components/reels/ReelPlayer';
import { useTheme } from '@/contexts/ThemeContext';
import { useMerchantReels } from '@/hooks/business/useMerchantReels';
import type { BusinessRootStackParamList } from '@/navigation/types';
import type { MerchantReel } from '@/services/merchantReelsApi';
import {
  canCancelMerchantReel,
  canForceRetryMerchantReel,
  isMerchantReelStuck,
} from '@/utils/merchantReelStuck';

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
  const {
    reels,
    loading,
    refreshing,
    mutatingId,
    error,
    load,
    setActive,
    retry,
    remove,
  } = useMerchantReels();
  const [filter, setFilter] = useState<FilterId>('all');
  const [snack, setSnack] = useState<string | null>(null);
  const [hideTarget, setHideTarget] = useState<MerchantReel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MerchantReel | null>(null);
  const [playTarget, setPlayTarget] = useState<MerchantReel | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      void load('initial');
      setNowMs(Date.now());
      const timer = setInterval(() => setNowMs(Date.now()), 60_000);
      return () => clearInterval(timer);
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

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await remove(id);
      setSnack(t('business.reels.mine.deleted', 'Reel deleted'));
    } catch (err: unknown) {
      setSnack(
        err instanceof Error
          ? err.message
          : t('business.reels.mine.deleteError', 'Could not delete reel')
      );
    }
  }, [deleteTarget, remove, t]);

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

  const onViewProduct = useCallback(
    (reel: MerchantReel) => {
      if (reel.subject_type === 'item' && reel.subject_id) {
        navigation.navigate('BusinessItemDetail', { itemId: reel.subject_id });
        return;
      }
      if (reel.subject_type === 'rental' && reel.subject_id) {
        navigation.navigate('BusinessRentalItemDetail', {
          itemId: reel.subject_id,
        });
      }
    },
    [navigation]
  );

  const filters = useMemo(
    () =>
      [
        ['all', t('business.reels.mine.filterAll', 'All')],
        ['pending', t('business.reels.mine.filterPending', 'In progress')],
        ['failed', t('business.reels.mine.filterFailed', 'Failed')],
        ['live', t('business.reels.mine.filterLive', 'Live')],
        ['inactive', t('business.reels.mine.filterInactive', 'Inactive')],
      ] as const,
    [t]
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.filters,
          { paddingHorizontal: spacing.md, gap: spacing.xs },
        ]}
        accessibilityLabel={t('business.reels.mine.filtersA11y', 'Reel filters')}
      >
        {filters.map(([id, label]) => {
          const selected = filter === id;
          return (
            <Pressable
              key={id}
              onPress={() => setFilter(id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <StatusPill
                compact
                label={label}
                backgroundColor={
                  selected ? `${colors.primary.main}22` : colors.surface
                }
                textColor={selected ? colors.primary.main : colors.text.secondary}
                borderColor={selected ? colors.primary.main : colors.divider}
              />
            </Pressable>
          );
        })}
      </ScrollView>

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
              onPress={() => navigation.navigate('BusinessAddReel')}
            >
              {t('business.reels.addFab', 'Add reel')}
            </Button>
          </View>
        }
        renderItem={({ item }) => (
          <ReelRowCard
            reel={item}
            nowMs={nowMs}
            mutating={mutatingId === item.id}
            onRetry={() => void onRetry(item.id)}
            onDelete={() => setDeleteTarget(item)}
            onPlay={() => setPlayTarget(item)}
            onViewProduct={() => onViewProduct(item)}
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

      <ConfirmActionDialog
        visible={!!deleteTarget}
        title={
          deleteTarget && isMerchantReelStuck({
            processingStatus: deleteTarget.processing_status,
            updatedAt: deleteTarget.updated_at,
            nowMs,
          })
            ? t('business.reels.mine.cancelTitle', 'Cancel this reel?')
            : t('business.reels.mine.deleteTitle', 'Delete this reel?')
        }
        message={
          deleteTarget && isMerchantReelStuck({
            processingStatus: deleteTarget.processing_status,
            updatedAt: deleteTarget.updated_at,
            nowMs,
          })
            ? t(
                'business.reels.mine.cancelBody',
                'This stops the stuck reel and removes it from your list. You can create a new one anytime.'
              )
            : t(
                'business.reels.mine.deleteBody',
                'This removes the failed reel from your list. You can create a new one anytime.'
              )
        }
        cancelLabel={t('common.dismiss', 'Keep')}
        confirmLabel={
          deleteTarget && isMerchantReelStuck({
            processingStatus: deleteTarget.processing_status,
            updatedAt: deleteTarget.updated_at,
            nowMs,
          })
            ? t('business.reels.mine.cancelConfirm', 'Cancel reel')
            : t('business.reels.mine.deleteConfirm', 'Delete')
        }
        destructive
        loading={mutatingId === deleteTarget?.id}
        onDismiss={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <Modal
        visible={!!playTarget?.video_url}
        animationType="fade"
        onRequestClose={() => setPlayTarget(null)}
      >
        <View style={[styles.playerRoot, { backgroundColor: '#000' }]}>
          <View style={{ paddingTop: insets.top, alignItems: 'flex-end' }}>
            <IconButton
              icon="close"
              iconColor="#fff"
              onPress={() => setPlayTarget(null)}
              accessibilityLabel={t('common.close', 'Close')}
            />
          </View>
          {playTarget?.video_url ? (
            <View style={styles.playerBody}>
              <ReelPlayer
                uri={playTarget.video_url}
                active
                posterUri={playTarget.thumbnail_url}
              />
            </View>
          ) : null}
        </View>
      </Modal>

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

function canRetry(reel: MerchantReel, nowMs: number): boolean {
  return canForceRetryMerchantReel({
    processingStatus: reel.processing_status,
    updatedAt: reel.updated_at,
    sourceS3Key: reel.source_s3_key,
    nowMs,
  });
}

function canCancel(reel: MerchantReel, nowMs: number): boolean {
  return canCancelMerchantReel({
    processingStatus: reel.processing_status,
    updatedAt: reel.updated_at,
    nowMs,
  });
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
  t: (key: string, fallback: string) => string,
  nowMs: number
): string {
  if (reel.processing_status === 'failed') {
    return t('business.reels.mine.statusFailed', 'Failed');
  }
  if (isLiveCapable(reel)) {
    return reel.is_active === false
      ? t('business.reels.mine.statusHidden', 'Hidden')
      : t('business.reels.mine.statusLive', 'Live');
  }
  if (
    isMerchantReelStuck({
      processingStatus: reel.processing_status,
      updatedAt: reel.updated_at,
      nowMs,
    })
  ) {
    return t('business.reels.mine.statusStuck', 'Stuck');
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

function statusColors(
  reel: MerchantReel,
  colors: ReturnType<typeof useTheme>['colors'],
  nowMs: number
): { bg: string; fg: string } {
  if (reel.processing_status === 'failed') {
    return { bg: '#fdecea', fg: '#b00020' };
  }
  if (
    isMerchantReelStuck({
      processingStatus: reel.processing_status,
      updatedAt: reel.updated_at,
      nowMs,
    })
  ) {
    return { bg: '#fff4e5', fg: '#b26a00' };
  }
  if (isLiveCapable(reel) && reel.is_active !== false) {
    return { bg: `${colors.primary.main}22`, fg: colors.primary.main };
  }
  return { bg: colors.surface, fg: colors.text.secondary };
}

function ReelRowCard(props: {
  reel: MerchantReel;
  nowMs: number;
  mutating: boolean;
  onRetry: () => void;
  onDelete: () => void;
  onPlay: () => void;
  onViewProduct: () => void;
  onToggleActive: (next: boolean) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  typography: ReturnType<typeof useTheme>['typography'];
  borderRadius: ReturnType<typeof useTheme>['borderRadius'];
  t: (key: string, fallback: string) => string;
}) {
  const {
    reel,
    nowMs,
    mutating,
    onRetry,
    onDelete,
    onPlay,
    onViewProduct,
    onToggleActive,
    colors,
    spacing,
    typography,
    borderRadius,
    t,
  } = props;
  const failed = reel.processing_status === 'failed';
  const stuck = isMerchantReelStuck({
    processingStatus: reel.processing_status,
    updatedAt: reel.updated_at,
    nowMs,
  });
  const showActions = canCancel(reel, nowMs);
  const retryable = canRetry(reel, nowMs);
  const liveCapable = isLiveCapable(reel);
  const active = reel.is_active !== false;
  const showProduct =
    (reel.subject_type === 'item' || reel.subject_type === 'rental') &&
    !!reel.subject_id;
  const playable = liveCapable && !!reel.video_url;
  const pill = statusColors(reel, colors, nowMs);

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
        <Pressable
          onPress={playable ? onPlay : undefined}
          disabled={!playable}
          accessibilityRole={playable ? 'button' : undefined}
          accessibilityLabel={
            playable ? t('business.reels.mine.play', 'Play reel') : undefined
          }
        >
          {reel.thumbnail_url ? (
            <Image source={{ uri: reel.thumbnail_url }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: colors.divider }]} />
          )}
          {playable ? (
            <View style={styles.playBadge}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          ) : null}
        </Pressable>
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
            <StatusPill
              compact
              label={statusLabel(reel, t, nowMs)}
              backgroundColor={pill.bg}
              textColor={pill.fg}
            />
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
      {stuck ? (
        <Text
          style={[
            typography.caption,
            { color: '#b26a00', marginTop: spacing.xs },
          ]}
        >
          {t(
            'business.reels.mine.stuckHint',
            'This is taking longer than usual. You can cancel or retry.'
          )}
        </Text>
      ) : null}
      {showProduct ? (
        <Button
          mode="text"
          compact
          onPress={onViewProduct}
          style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
        >
          {t('business.reels.mine.viewProduct', 'View product')}
        </Button>
      ) : null}
      {showActions ? (
        <View style={[styles.actionsRow, { marginTop: spacing.sm, gap: spacing.sm }]}>
          {retryable ? (
            <Button
              mode="contained"
              loading={mutating}
              disabled={mutating}
              onPress={onRetry}
              style={{ flex: 1 }}
            >
              {stuck
                ? t('business.reels.mine.forceRetry', 'Force retry')
                : t('business.reels.mine.retry', 'Retry')}
            </Button>
          ) : null}
          <Button
            mode={retryable ? 'outlined' : 'contained'}
            loading={mutating}
            disabled={mutating}
            onPress={onDelete}
            style={{ flex: 1 }}
            textColor={retryable ? '#b00020' : undefined}
          >
            {stuck
              ? t('business.reels.mine.cancel', 'Cancel')
              : t('business.reels.mine.delete', 'Delete')}
          </Button>
        </View>
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
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  card: { borderWidth: 1 },
  row: { flexDirection: 'row' },
  thumb: { width: 72, height: 108, borderRadius: 10 },
  playBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
  },
  playIcon: { color: '#fff', fontSize: 22 },
  meta: { flex: 1, marginLeft: 12, justifyContent: 'center', gap: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  playerRoot: { flex: 1 },
  playerBody: { flex: 1 },
});
