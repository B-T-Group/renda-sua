import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  Chip,
  Snackbar,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import {
  listMerchantReels,
  retryMerchantReel,
  type MerchantReel,
} from '@/services/merchantReelsApi';

type FilterId = 'all' | 'pending' | 'failed' | 'live';

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
  const [reels, setReels] = useState<MerchantReel[]>([]);
  const [filter, setFilter] = useState<FilterId>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      setReels(await listMerchantReels());
    } catch (err: unknown) {
      setSnack(
        err instanceof Error
          ? err.message
          : t('business.reels.mine.loadError', 'Could not load your reels')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load])
  );

  const filtered = useMemo(
    () => reels.filter((reel) => matchesFilter(reel, filter)),
    [reels, filter]
  );

  const onRetry = useCallback(
    async (reelId: string) => {
      setRetryingId(reelId);
      try {
        await retryMerchantReel(reelId);
        setSnack(t('business.reels.mine.retryQueued', 'Retry queued'));
        await load('refresh');
      } catch (err: unknown) {
        setSnack(
          err instanceof Error
            ? err.message
            : t('business.reels.mine.retryError', 'Could not retry reel')
        );
      } finally {
        setRetryingId(null);
      }
    },
    [load, t]
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
      <View style={[styles.filters, { paddingHorizontal: spacing.md }]}>
        {(
          [
            ['all', t('business.reels.mine.filterAll', 'All')],
            ['pending', t('business.reels.mine.filterPending', 'In progress')],
            ['failed', t('business.reels.mine.filterFailed', 'Failed')],
            ['live', t('business.reels.mine.filterLive', 'Live')],
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
          <Text style={[typography.body2, { color: colors.text.secondary }]}>
            {t('business.reels.mine.empty', 'No reels in this filter yet.')}
          </Text>
        }
        renderItem={({ item }) => (
          <ReelRowCard
            reel={item}
            retrying={retryingId === item.id}
            onRetry={() => void onRetry(item.id)}
            colors={colors}
            spacing={spacing}
            typography={typography}
            borderRadius={borderRadius}
            t={t}
          />
        )}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3500}>
        {snack}
      </Snackbar>
    </View>
  );
}

function matchesFilter(reel: MerchantReel, filter: FilterId): boolean {
  if (filter === 'all') return true;
  if (filter === 'failed') return reel.processing_status === 'failed';
  if (filter === 'live') {
    return (
      reel.processing_status === 'ready' && reel.moderation_status === 'approved'
    );
  }
  if (reel.processing_status === 'failed') return false;
  if (
    reel.processing_status === 'ready' &&
    reel.moderation_status === 'approved'
  ) {
    return false;
  }
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
  if (
    reel.processing_status === 'ready' &&
    reel.moderation_status === 'approved'
  ) {
    return t('business.reels.mine.statusLive', 'Live');
  }
  if (PENDING_PROCESSING.has(reel.processing_status)) {
    return t('business.reels.mine.statusProcessing', 'Processing');
  }
  if (reel.moderation_status === 'pending' || reel.moderation_status === 'ai_reviewing') {
    return t('business.reels.mine.statusPendingReview', 'Pending review');
  }
  return reel.processing_status || reel.moderation_status;
}

function ReelRowCard(props: {
  reel: MerchantReel;
  retrying: boolean;
  onRetry: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  typography: ReturnType<typeof useTheme>['typography'];
  borderRadius: ReturnType<typeof useTheme>['borderRadius'];
  t: (key: string, fallback: string) => string;
}) {
  const { reel, retrying, onRetry, colors, spacing, typography, borderRadius, t } =
    props;
  const failed = reel.processing_status === 'failed';
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
          <View
            style={[styles.thumb, { backgroundColor: colors.divider }]}
          />
        )}
        <View style={styles.meta}>
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {reel.generation_source === 'ai'
              ? t('business.reels.mine.sourceAi', 'AI ad')
              : t('business.reels.mine.sourceUpload', 'Upload')}
          </Text>
          <Text style={[typography.caption, { color: colors.text.secondary }]}>
            {statusLabel(reel, t)}
          </Text>
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
          loading={retrying}
          disabled={retrying}
          onPress={onRetry}
          style={{ marginTop: spacing.sm }}
        >
          {t('business.reels.mine.retry', 'Retry')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 8 },
  card: { borderWidth: 1 },
  row: { flexDirection: 'row' },
  thumb: { width: 64, height: 96, borderRadius: 8 },
  meta: { flex: 1, marginLeft: 12, justifyContent: 'center' },
});
