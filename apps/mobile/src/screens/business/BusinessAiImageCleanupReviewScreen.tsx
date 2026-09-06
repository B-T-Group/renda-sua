import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Button,
  Snackbar,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusPill } from '../../components/common/StatusPill';
import { ImageCleanupPreviewDialog } from '../../components/dialogs/ImageCleanupPreviewDialog';
import { useTheme } from '../../contexts/ThemeContext';
import { useProfileMe } from '../../hooks/useProfileMe';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/businessApi';
import { rentalItemImagesApi } from '../../services/rentalItemImagesApi';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessAiImageCleanupReview'>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

type ResultRow = {
  id: string;
  business_image_id: string | null;
  item_variant_image_id?: string | null;
  rental_item_image_id?: string | null;
  kind?: 'rembg' | 'ai' | null;
  original_image_url: string;
  cleaned_image_url: string | null;
  rembg_image_url?: string | null;
  enhanced_image_url?: string | null;
  status: string;
  error_message: string | null;
  retry_of_result_id?: string | null;
  confidence_tier?: 'high' | 'medium' | 'low' | null;
  changes?: string[] | null;
  applied_at?: string | null;
  reverted_at?: string | null;
};

export default function BusinessAiImageCleanupReviewScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const jobId = route.params.jobId;
  const { me, refetch: refetchMe } = useProfileMe();
  const aiTokens = me?.business?.ai_tokens ?? 0;

  const [results, setResults] = useState<ResultRow[]>([]);
  const [itemId, setItemId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [canCancel, setCanCancel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<ResultRow | null>(null);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      try {
        const res = await businessApi.aiImageCleanup.getJob(jobId);
        const job = res.data?.job;
        if (!job) throw new Error('Job not found');
        const label = job.item_variant?.name ?? job.item?.name ?? '';
        setItemName(label);
        setItemId(job.item_id);
        setVariantId(job.item_variant_id ?? null);
        setResults(job.results ?? []);
        setCanCancel(job.status === 'ready_for_review' || job.status === 'failed');
      } catch (e: unknown) {
        setSnack(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [jobId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const snackForAction = (action: string) => {
    if (action === 'accept') {
      return t('business.images.asyncCleanup.acceptSuccess', 'Image updated');
    }
    if (action === 'dismiss') {
      return t('business.images.asyncCleanup.dismissSuccess', 'Removed from review');
    }
    if (action === 'reject') {
      return t('business.images.asyncCleanup.rejectSuccess', 'Kept original');
    }
    if (action === 'revert') {
      return t('business.images.enhancement.reverted', 'Restored original photo');
    }
    if (action === 'reapply') {
      return t('business.images.enhancement.reapplied', 'Enhanced photo restored');
    }
    if (action === 'upgrade') {
      return t(
        'business.images.cleanupKinds.upgradeStarted',
        'AI enhancement started'
      );
    }
    return t('business.images.asyncCleanup.retryStarted', 'Retry started');
  };

  const runAction = async (
    resultId: string,
    action: 'accept' | 'reject' | 'retry' | 'dismiss' | 'revert' | 'reapply'
  ) => {
    setBusyId(resultId);
    try {
      if (action === 'accept') await businessApi.aiImageCleanup.accept(resultId);
      else if (action === 'reject' || action === 'dismiss') {
        await businessApi.aiImageCleanup.reject(resultId);
      } else if (action === 'revert') {
        await businessApi.aiImageCleanup.revert(resultId);
      } else if (action === 'reapply') {
        await businessApi.aiImageCleanup.reapply(resultId);
      } else {
        await businessApi.aiImageCleanup.retry(resultId);
      }
      await load({ silent: true });
      setSnack(snackForAction(action));
      setCompareResult(null);
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const upgradeToAi = async (result: ResultRow) => {
    const imageId =
      result.business_image_id ||
      result.item_variant_image_id ||
      result.rental_item_image_id;
    if (!imageId) {
      setSnack(t('common.error', 'Something went wrong'));
      return;
    }
    if (aiTokens <= 0) {
      setSnack(
        t(
          'business.images.cleanupKinds.needTokens',
          'Buy AI tokens to enhance with AI'
        )
      );
      return;
    }
    setBusyId(result.id);
    try {
      if (result.item_variant_image_id && variantId) {
        await businessApi.aiImageCleanup.requestForVariant(variantId, {
          selections: [{ imageId, kind: 'ai' }],
        });
      } else if (itemId) {
        await businessApi.aiImageCleanup.request(itemId, {
          selections: [{ imageId, kind: 'ai' }],
        });
      } else if (result.rental_item_image_id) {
        await rentalItemImagesApi.cleanup(imageId, { kind: 'ai' });
      } else {
        await businessApi.images.cleanup(imageId, { kind: 'ai' });
      }
      await refetchMe();
      await load({ silent: true });
      setSnack(snackForAction('upgrade'));
      setCompareResult(null);
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Upgrade failed');
    } finally {
      setBusyId(null);
    }
  };

  const setImageVersion = async (
    result: ResultRow,
    version: 'original' | 'rembg' | 'enhanced'
  ) => {
    const businessImageId = result.business_image_id;
    const rentalImageId = result.rental_item_image_id;
    if (!businessImageId && !rentalImageId) {
      // Variant images: no PATCH active-version yet — use accept/reapply/revert.
      if (version === 'original') {
        await runAction(result.id, 'revert');
        return;
      }
      if (result.status === 'ready') {
        await runAction(result.id, 'accept');
        return;
      }
      await runAction(result.id, 'reapply');
      return;
    }
    setBusyId(result.id);
    try {
      if (rentalImageId) {
        await rentalItemImagesApi.setActiveVersion(rentalImageId, version);
      } else if (businessImageId) {
        await businessApi.images.setActiveVersion(businessImageId, version);
      }
      await load({ silent: true });
      setSnack(t('business.images.versions.updated', 'Listing photo updated'));
      setCompareResult(null);
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Could not update version');
    } finally {
      setBusyId(null);
    }
  };

  const acceptAllReady = async () => {
    const ready = results.filter((r) => r.status === 'ready');
    for (const r of ready) {
      await runAction(r.id, 'accept');
    }
  };

  const cancelAll = () => {
    Alert.alert(
      t(
        'business.images.asyncCleanup.cancelAllConfirmTitle',
        'Leave without applying?'
      ),
      t(
        'business.images.asyncCleanup.cancelAllConfirmBody',
        'Remaining cleaned photos will be discarded. Photos you already accepted stay applied. Other originals stay unchanged.'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('business.images.asyncCleanup.cancelAll', 'Cancel all'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCancelling(true);
              try {
                await businessApi.aiImageCleanup.cancel(jobId);
                setSnack(
                  t(
                    'business.images.asyncCleanup.cancelAllSuccess',
                    'Cleanup cancelled'
                  )
                );
                navigation.goBack();
              } catch (e: unknown) {
                setSnack(
                  e instanceof Error
                    ? e.message
                    : t(
                        'business.images.asyncCleanup.cancelAllFailed',
                        'Could not cancel cleanup'
                      )
                );
              } finally {
                setCancelling(false);
              }
            })();
          },
        },
      ]
    );
  };

  const visibleResults = results.filter((r) =>
    isVisibleCleanupResult(r, results)
  );

  const rembgUrlFor = (r: ResultRow) =>
    r.rembg_image_url ||
    (r.kind === 'rembg' ? r.cleaned_image_url : null) ||
    null;

  const enhancedUrlFor = (r: ResultRow) =>
    r.enhanced_image_url ||
    (r.kind === 'ai' || r.kind == null ? r.cleaned_image_url : null) ||
    null;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(insets.bottom, 24) + 24,
        }}
      >
        <Text variant="titleLarge" style={{ color: colors.text.primary, fontWeight: '600' }}>
          {t('business.images.asyncCleanup.reviewTitle', 'Review cleaned photos')}
        </Text>
        {itemName ? (
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 16 }}>
            {itemName}
          </Text>
        ) : null}

        {visibleResults.filter((r) => r.status === 'ready').length > 1 ? (
          <Button
            mode="contained"
            onPress={() => void acceptAllReady()}
            disabled={!!busyId || cancelling}
            style={{ marginBottom: 16, borderRadius: 12 }}
          >
            {t('business.images.asyncCleanup.acceptAll', 'Accept all ready')}
          </Button>
        ) : null}

        {visibleResults.length === 0 ? (
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.secondary, marginBottom: 16 }}
          >
            {t(
              'business.images.asyncCleanup.emptyReview',
              'Nothing left to review for this cleanup.'
            )}
          </Text>
        ) : null}

        {visibleResults.map((result) => (
          <ResultCard
            key={result.id}
            result={result}
            busyId={busyId}
            cancelling={cancelling}
            aiTokens={aiTokens}
            colors={colors}
            spacing={spacing}
            borderRadius={borderRadius}
            shadows={shadows}
            rembgUrl={rembgUrlFor(result)}
            enhancedUrl={enhancedUrlFor(result)}
            onOpenCompare={() => setCompareResult(result)}
            onAction={(action) => void runAction(result.id, action)}
            onUpgrade={() => void upgradeToAi(result)}
            t={t}
          />
        ))}

        {canCancel ? (
          <Button
            mode="outlined"
            textColor={colors.error.main}
            loading={cancelling}
            disabled={!!busyId || cancelling}
            onPress={cancelAll}
            style={{ marginBottom: 8, borderRadius: 12 }}
          >
            {t('business.images.asyncCleanup.cancelAll', 'Cancel all')}
          </Button>
        ) : null}

        <Button mode="text" onPress={() => navigation.goBack()} disabled={cancelling}>
          {t('common.done', 'Done')}
        </Button>
      </ScrollView>

      <ImageCleanupPreviewDialog
        visible={!!compareResult}
        originalUrl={compareResult?.original_image_url ?? ''}
        rembgUrl={compareResult ? rembgUrlFor(compareResult) : null}
        enhancedUrl={compareResult ? enhancedUrlFor(compareResult) : null}
        kind={
          compareResult?.kind ??
          (compareResult && enhancedUrlFor(compareResult) ? 'ai' : 'rembg')
        }
        changes={compareResult?.changes}
        confidenceTier={compareResult?.confidence_tier}
        initiallyShowOriginal={!!compareResult?.reverted_at}
        canUpgradeToAi={
          !!compareResult &&
          compareResult.kind === 'rembg' &&
          compareResult.status === 'ready' &&
          !enhancedUrlFor(compareResult) &&
          aiTokens > 0
        }
        actions={
          compareResult?.status === 'accepted' || compareResult?.reverted_at
            ? 'version-toggle'
            : compareResult?.kind === 'rembg'
              ? 'review-rembg'
              : 'review-ai'
        }
        busy={busyId === compareResult?.id}
        onDismiss={() => setCompareResult(null)}
        onAccept={
          compareResult?.status === 'ready'
            ? () => void runAction(compareResult.id, 'accept')
            : undefined
        }
        onReject={
          compareResult?.status === 'ready'
            ? () => void runAction(compareResult.id, 'reject')
            : undefined
        }
        onUseOriginal={
          compareResult
            ? () => void setImageVersion(compareResult, 'original')
            : undefined
        }
        onUseRembg={
          compareResult && rembgUrlFor(compareResult)
            ? () => void setImageVersion(compareResult, 'rembg')
            : undefined
        }
        onUseEnhanced={
          compareResult && enhancedUrlFor(compareResult)
            ? () => void setImageVersion(compareResult, 'enhanced')
            : undefined
        }
        onUpgradeToAi={
          compareResult
            ? () => void upgradeToAi(compareResult)
            : undefined
        }
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </View>
  );
}

function ResultCard({
  result,
  busyId,
  cancelling,
  aiTokens,
  colors,
  spacing,
  borderRadius,
  shadows,
  rembgUrl,
  enhancedUrl,
  onOpenCompare,
  onAction,
  onUpgrade,
  t,
}: {
  result: ResultRow;
  busyId: string | null;
  cancelling: boolean;
  aiTokens: number;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  borderRadius: ReturnType<typeof useTheme>['borderRadius'];
  shadows: ReturnType<typeof useTheme>['shadows'];
  rembgUrl: string | null;
  enhancedUrl: string | null;
  onOpenCompare: () => void;
  onAction: (action: 'accept' | 'reject' | 'retry' | 'dismiss' | 'revert' | 'reapply') => void;
  onUpgrade: () => void;
  t: (key: string, def: string) => string;
}) {
  const cleanedPreview = enhancedUrl || rembgUrl || result.cleaned_image_url;
  const cleanedLabel =
    result.kind === 'rembg'
      ? t('business.images.versions.noBg', 'No bg')
      : t('business.images.cleanup.cleaned', 'Enhanced');
  const canUpgrade =
    result.kind === 'rembg' &&
    result.status === 'ready' &&
    !enhancedUrl &&
    aiTokens > 0;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      <View style={styles.metaRow}>
        {result.kind === 'rembg' ? (
          <StatusPill
            compact
            label={t('business.images.cleanupKinds.removeBg', 'Remove bg')}
            backgroundColor={colors.pageBackground}
            textColor={colors.text.secondary}
            borderColor={colors.divider}
          />
        ) : null}
        {result.kind === 'ai' || (!result.kind && result.cleaned_image_url) ? (
          <StatusPill
            compact
            label={t('business.images.cleanupKinds.aiShort', 'AI')}
            backgroundColor={colors.pageBackground}
            textColor={colors.text.secondary}
            borderColor={colors.divider}
          />
        ) : null}
        {result.confidence_tier ? (
          <StatusPill
            compact
            label={tierLabel(result.confidence_tier, t)}
            backgroundColor={colors.pageBackground}
            textColor={colors.text.secondary}
            borderColor={colors.divider}
          />
        ) : null}
        <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
          {result.status}
        </Text>
      </View>

      <Pressable onPress={onOpenCompare} accessibilityRole="button">
        <View style={styles.compare}>
          <View style={styles.col}>
            <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
              {t('business.images.cleanup.original', 'Original')}
            </Text>
            <Image source={{ uri: result.original_image_url }} style={styles.img} />
          </View>
          <View style={styles.col}>
            <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
              {cleanedLabel}
            </Text>
            {cleanedPreview ? (
              <Image source={{ uri: cleanedPreview }} style={styles.img} />
            ) : (
              <View style={[styles.img, styles.placeholder, { backgroundColor: colors.divider }]}>
                <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                  {result.status === 'failed'
                    ? t('business.images.asyncCleanup.failed', 'Failed')
                    : t('business.images.asyncCleanup.processing', 'Processing…')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>

      {result.changes?.length ? (
        <View style={{ marginBottom: 8 }}>
          {result.changes.slice(0, 3).map((change) => (
            <Text key={change} variant="bodySmall" style={{ color: colors.text.secondary }}>
              • {change}
            </Text>
          ))}
        </View>
      ) : null}

      {result.error_message ? (
        <Text variant="bodySmall" style={{ color: colors.error.main, marginBottom: 8 }}>
          {result.error_message}
        </Text>
      ) : null}

      <View style={styles.rowActions}>
        {result.status === 'ready' ? (
          <>
            <Button
              mode="contained"
              compact
              loading={busyId === result.id}
              disabled={!!busyId || cancelling}
              onPress={() => onAction('accept')}
            >
              {result.kind === 'rembg'
                ? t('business.images.cleanupKinds.useThis', 'Use this')
                : t('business.images.cleanup.accept', 'Accept')}
            </Button>
            {canUpgrade ? (
              <Button
                mode="outlined"
                compact
                disabled={!!busyId || cancelling}
                onPress={onUpgrade}
              >
                {t('business.images.cleanupKinds.enhanceWithAiShort', 'Enhance with AI')}
              </Button>
            ) : null}
            <Button
              mode="outlined"
              compact
              disabled={!!busyId || cancelling}
              onPress={() => onAction('reject')}
            >
              {t('business.images.enhancement.useOriginal', 'Keep original')}
            </Button>
          </>
        ) : null}
        {result.status === 'accepted' && !result.reverted_at ? (
          <Button
            mode="outlined"
            compact
            loading={busyId === result.id}
            disabled={!!busyId || cancelling}
            onPress={() => onAction('revert')}
          >
            {t('business.images.enhancement.useOriginal', 'Use original')}
          </Button>
        ) : null}
        {result.status === 'accepted' && result.reverted_at ? (
          <Button
            mode="contained"
            compact
            loading={busyId === result.id}
            disabled={!!busyId || cancelling}
            onPress={() => onAction('reapply')}
          >
            {t('business.images.enhancement.useEnhanced', 'Use enhanced')}
          </Button>
        ) : null}
        {result.status === 'failed' || result.status === 'rejected' ? (
          <>
            <Button
              mode="outlined"
              compact
              loading={busyId === result.id}
              disabled={!!busyId || cancelling}
              onPress={() => onAction('retry')}
              icon="refresh"
            >
              {t('business.images.asyncCleanup.retry', 'Retry')}
            </Button>
            {result.status === 'failed' ? (
              <Button
                mode="text"
                compact
                textColor={colors.error.main}
                disabled={!!busyId || cancelling}
                onPress={() => onAction('dismiss')}
              >
                {t('business.images.asyncCleanup.dismiss', 'Dismiss')}
              </Button>
            ) : null}
          </>
        ) : null}
        <Button mode="text" compact onPress={onOpenCompare} disabled={cancelling}>
          {t('business.images.enhancement.compare', 'Compare')}
        </Button>
      </View>
    </View>
  );
}

function tierLabel(tier: string, t: (key: string, def: string) => string): string {
  if (tier === 'high') return t('business.images.enhancement.tierHigh', 'High confidence');
  if (tier === 'medium') {
    return t('business.images.enhancement.tierMedium', 'Medium confidence');
  }
  return t('business.images.enhancement.tierLow', 'Needs review');
}

function isVisibleCleanupResult(result: ResultRow, all: ResultRow[]): boolean {
  if (all.some((r) => r.retry_of_result_id === result.id)) return false;
  if (result.status === 'rejected' && !result.cleaned_image_url) return false;
  return true;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, padding: 12 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  compare: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  col: { flex: 1, minWidth: 0 },
  img: { width: '100%', height: 140, borderRadius: 8, marginTop: 4 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
