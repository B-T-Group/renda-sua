import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Button, Card, Snackbar, Text } from 'react-native-paper';
import { ImageActiveVersionPicker } from '../images/ImageActiveVersionPicker';
import { ImageCleanupKindChips } from '../images/ImageCleanupKindChips';
import { ConfirmActionDialog } from '../../dialogs/ConfirmActionDialog';
import { StatusPill } from '../../common/StatusPill';
import { useTheme } from '../../../contexts/ThemeContext';
import { useImageEnhancements } from '../../../hooks/useImageEnhancements';
import { useProfileMe } from '../../../hooks/useProfileMe';
import { businessApi } from '../../../services/businessApi';
import { uploadBusinessImages } from '../../../services/businessImageUpload';
import type { BusinessCatalogItem, BusinessItemImage } from '../../../types/business/items';
import type { ImageActiveVersion, ImageCleanupKind } from '../../../types/imageCleanup';
import { isPrimaryItemImageType, orderedItemImages } from '../../../utils/itemImages';
import {
  filterSupportedImageAssets,
  IMAGE_LIBRARY_PICKER_OPTIONS,
} from '../../../utils/supportedImageFormats';

const PHOTO_ASPECT = 3 / 2;

type Props = {
  item: BusinessCatalogItem;
  businessId: string;
  imageCleanupEnabled?: boolean;
  aiTokensRemaining?: number;
  onChanged: () => void;
  onMessage: (text: string) => void;
  /** Compact chrome for item detail (photos are the page hero). */
  variant?: 'section' | 'hero';
  onPreviewPhoto?: (index: number) => void;
};

export function ItemImageManagementSection({
  item,
  businessId,
  imageCleanupEnabled = false,
  aiTokensRemaining = 0,
  onChanged,
  onMessage,
  variant = 'section',
  onPreviewPhoto,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { refetch: refetchMe } = useProfileMe();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingKinds, setPendingKinds] = useState<
    Record<string, ImageCleanupKind | null>
  >({});
  const enhancements = useImageEnhancements();
  const prevInFlightRef = useRef(0);

  useEffect(() => {
    const prev = prevInFlightRef.current;
    prevInFlightRef.current = enhancements.inFlightJobIds.length;
    if (prev > 0 && enhancements.inFlightJobIds.length === 0) {
      onChanged();
    }
  }, [enhancements.inFlightJobIds.length, onChanged]);

  const images = orderedItemImages(item.item_images);
  const isHero = variant === 'hero';
  const addPhotosLabel = t('business.items.addPhotos', 'Add photos');

  const runAction = useCallback(
    async (imageId: string, action: () => Promise<void>, successKey: string, defaultMsg: string) => {
      setBusyId(imageId);
      try {
        await action();
        onMessage(t(successKey, defaultMsg));
        onChanged();
      } catch (e: unknown) {
        onMessage(e instanceof Error ? e.message : t('common.error', 'Something went wrong'));
      } finally {
        setBusyId(null);
      }
    },
    [onChanged, onMessage, t]
  );

  const pickAndUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      onMessage(t('business.items.images.permissionDenied', 'Photo library permission is required'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      ...IMAGE_LIBRARY_PICKER_OPTIONS,
      allowsMultipleSelection: true,
    });
    if (result.canceled || !result.assets.length) return;
    const { supported, rejectedCount } = filterSupportedImageAssets(result.assets);
    if (rejectedCount > 0) {
      onMessage(
        t(
          'business.images.upload.unsupportedFormat',
          'Some photos were skipped. Please use JPEG, PNG, or WebP.'
        )
      );
    }
    if (!supported.length) return;

    setUploading(true);
    try {
      const ids = await uploadBusinessImages(supported, businessId);
      for (const imageId of ids) {
        await businessApi.images.associateItem(imageId, item.id);
      }
      onMessage(t('business.items.images.uploaded', 'Photos added'));
      onChanged();
    } catch (e: unknown) {
      onMessage(e instanceof Error ? e.message : t('business.items.images.uploadError', 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleEnqueueCleanup = useCallback(
    async (img: BusinessItemImage, kind: ImageCleanupKind) => {
      if (!img.id) return;
      if (kind === 'ai' && img.is_ai_cleaned) {
        onMessage(
          t(
            'business.items.images.cleanup.alreadyCleaned',
            'Image already has an AI version'
          )
        );
        return;
      }
      if (kind === 'rembg' && img.is_rembg_cleaned) {
        onMessage(
          t(
            'business.items.images.cleanup.alreadyRembg',
            'Background already removed for this photo'
          )
        );
        return;
      }
      if (kind === 'ai' && aiTokensRemaining <= 0) {
        onMessage(
          t(
            'business.images.cleanupKinds.needTokens',
            'Buy AI tokens to enhance with AI'
          )
        );
        return;
      }
      setBusyId(img.id);
      try {
        const res = await businessApi.images.cleanup(img.id, { kind });
        const jobId = res.data?.jobId ?? res.data?.job?.id;
        if (!res.success || !jobId) {
          throw new Error(
            res.error ||
              t('business.items.images.cleanup.error', 'Cleanup failed')
          );
        }
        enhancements.trackJob(jobId, [img.id]);
        setPendingKinds((prev) => {
          const next = { ...prev };
          delete next[img.id!];
          return next;
        });
        onMessage(
          kind === 'rembg'
            ? t(
                'business.images.cleanupKinds.rembgQueued',
                'Background removal started — we’ll update this photo in the background.'
              )
            : t(
                'business.images.enhancement.queued',
                'Enhancement started — we’ll update this photo in the background.'
              )
        );
        void refetchMe();
      } catch (e: unknown) {
        onMessage(
          e instanceof Error
            ? e.message
            : t('business.items.images.cleanup.error', 'Cleanup failed')
        );
      } finally {
        setBusyId(null);
      }
    },
    [aiTokensRemaining, enhancements, onMessage, refetchMe, t]
  );

  const handleSetActiveVersion = useCallback(
    async (img: BusinessItemImage, version: ImageActiveVersion) => {
      if (!img.id) return;
      await runAction(
        img.id,
        () =>
          businessApi.images.setActiveVersion(img.id!, version).then(() => undefined),
        'business.images.versions.updated',
        'Listing photo updated'
      );
    },
    [runAction]
  );

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    await runAction(
      id,
      () => businessApi.images.deleteImage(id).then(() => undefined),
      'business.items.images.deleted',
      'Photo removed'
    );
  };

  return (
    <View style={[styles.section, { marginTop: isHero ? 0 : spacing.lg }]}>
      {isHero ? (
        images.length > 0 ? (
          <View style={[styles.header, { marginBottom: spacing.sm, justifyContent: 'flex-end' }]}>
            <Button
              mode="contained"
              icon="camera-plus"
              loading={uploading}
              onPress={() => void pickAndUpload()}
              compact
            >
              {addPhotosLabel}
            </Button>
          </View>
        ) : null
      ) : (
        <>
          <View style={styles.header}>
            <Text variant="titleMedium" style={{ fontWeight: '700', flex: 1 }}>
              {t('business.items.imageManagement', 'Image Management')}
            </Text>
            <Button
              mode="contained"
              icon="camera-plus"
              loading={uploading}
              onPress={() => void pickAndUpload()}
            >
              {t('business.inventory.manageImages', 'Manage Images')}
            </Button>
          </View>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
          >
            {t(
              'business.items.imageManagementDescription',
              'Upload photos and choose which image is the main listing photo.'
            )}
          </Text>
        </>
      )}

      {imageCleanupEnabled && images.length > 0 ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
        >
          {t(
            'business.images.cleanupKinds.tokensRemaining',
            '{{count}} AI tokens remaining',
            { count: aiTokensRemaining }
          )}
        </Text>
      ) : null}

      {images.length === 0 ? (
        <Pressable
          onPress={() => void pickAndUpload()}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel={addPhotosLabel}
          style={[
            styles.emptyHero,
            {
              borderColor: colors.primary.main,
              backgroundColor: colors.primaryTint,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          {uploading ? (
            <ActivityIndicator />
          ) : (
            <MaterialCommunityIcons
              name="camera-plus-outline"
              size={36}
              color={colors.primary.main}
            />
          )}
          <Text
            variant="titleSmall"
            style={{ color: colors.primary.main, fontWeight: '700', marginTop: 8 }}
          >
            {addPhotosLabel}
          </Text>
        </Pressable>
      ) : (
        <ImagePages
          images={images}
          renderCard={(img, index) => {
            const hasRembg = !!img.is_rembg_cleaned || !!img.rembg_image_url;
            const hasEnhanced = !!img.is_ai_cleaned || !!img.enhanced_image_url;
            const hasVersions = hasRembg || hasEnhanced;
            const activeVersion: ImageActiveVersion =
              img.active_version === 'rembg' ||
              img.active_version === 'enhanced' ||
              img.active_version === 'original'
                ? img.active_version
                : hasEnhanced
                  ? 'enhanced'
                  : hasRembg
                    ? 'rembg'
                    : 'original';
            const enhancing = !!img.id && enhancements.isEnhancing(img.id);
            const showEnqueue =
              imageCleanupEnabled &&
              !enhancing &&
              (!hasRembg || (!hasEnhanced && aiTokensRemaining >= 0));

            return (
              <ImageCard
                image={img}
                busy={busyId === img.id}
                enhancing={enhancing}
                borderRadius={borderRadius.md}
                hasRembg={hasRembg}
                hasEnhanced={hasEnhanced}
                hasVersions={hasVersions}
                activeVersion={activeVersion}
                showEnqueue={showEnqueue}
                pendingKind={img.id ? pendingKinds[img.id] ?? null : null}
                aiTokensRemaining={aiTokensRemaining}
                onPreview={onPreviewPhoto ? () => onPreviewPhoto(index) : undefined}
                onPendingKindChange={(kind) => {
                  if (!img.id) return;
                  setPendingKinds((prev) => ({ ...prev, [img.id!]: kind }));
                }}
                onEnqueue={(kind) => void handleEnqueueCleanup(img, kind)}
                onSetVersion={(version) => void handleSetActiveVersion(img, version)}
                onSetMain={() =>
                  void runAction(
                    img.id!,
                    () => businessApi.images.setAsMain(img.id!).then(() => undefined),
                    'business.items.mainImageUpdated',
                    'Main image updated'
                  )
                }
                onSetGallery={() =>
                  void runAction(
                    img.id!,
                    () => businessApi.images.setAsGallery(img.id!).then(() => undefined),
                    'business.items.secondaryImageUpdated',
                    'Gallery image updated'
                  )
                }
                onDelete={() => img.id && setDeleteId(img.id)}
                t={t}
              />
            );
          }}
        />
      )}

      <ConfirmActionDialog
        visible={!!deleteId}
        title={t('business.items.images.deleteTitle', 'Remove photo?')}
        message={t('business.items.images.deleteBody', 'This photo will be removed from your library.')}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('common.delete', 'Delete')}
        destructive
        onDismiss={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />

      <Snackbar
        visible={!!enhancements.activeToast}
        onDismiss={enhancements.dismissToast}
        duration={4000}
        action={
          enhancements.activeToast?.canRevert
            ? {
                label: t('business.images.enhancement.useOriginal', 'Use original'),
                onPress: () => {
                  void (async () => {
                    await enhancements.revertFromToast();
                    onChanged();
                  })();
                },
              }
            : undefined
        }
      >
        {enhancements.activeToast?.message}
      </Snackbar>
    </View>
  );
}

function ImagePages({
  images,
  renderCard,
}: {
  images: BusinessItemImage[];
  renderCard: (img: BusinessItemImage, index: number) => ReactNode;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index > images.length - 1) {
      setIndex(Math.max(0, images.length - 1));
    }
  }, [images.length, index]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setIndex(Math.min(Math.max(0, next), images.length - 1));
  };

  return (
    <View
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== pageWidth) setPageWidth(w);
      }}
    >
      {pageWidth > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          nestedScrollEnabled
          directionalLockEnabled
          scrollEnabled={images.length > 1}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          onMomentumScrollEnd={onScrollEnd}
        >
          {images.map((img, index) => (
            <View key={img.id} style={{ width: pageWidth }}>
              {renderCard(img, index)}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={{ minHeight: 120 }} />
      )}
      {images.length > 1 ? (
        <View style={[styles.pager, { marginTop: spacing.sm }]}>
          <Text variant="labelMedium" style={{ color: colors.text.secondary }}>
            {t('business.items.images.photoOf', 'Photo {{current}} of {{total}}', {
              current: index + 1,
              total: images.length,
            })}
          </Text>
          <View style={[styles.dots, { gap: spacing.xs }]}>
            {images.map((img, i) => (
              <View
                key={img.id}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === index ? colors.primary.main : colors.divider,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ImageStatusChip({
  isMain,
  label,
}: {
  isMain: boolean;
  label: string;
}) {
  const { colors, borderRadius } = useTheme();
  const fg = isMain ? colors.primary.contrast : colors.text.secondary;
  return (
    <View
      style={[
        styles.statusBadge,
        {
          borderRadius: borderRadius.sm,
          backgroundColor: isMain ? colors.primary.main : colors.surface,
          borderWidth: isMain ? 0 : StyleSheet.hairlineWidth,
          borderColor: colors.divider,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={isMain ? 'star' : 'image-multiple-outline'}
        size={14}
        color={fg}
      />
      <Text variant="labelSmall" style={[styles.statusBadgeText, { color: fg }]}>
        {label}
      </Text>
    </View>
  );
}

function ImageCard({
  image,
  busy,
  enhancing,
  borderRadius,
  hasRembg,
  hasEnhanced,
  hasVersions,
  activeVersion,
  showEnqueue,
  pendingKind,
  aiTokensRemaining,
  onPreview,
  onPendingKindChange,
  onEnqueue,
  onSetVersion,
  onSetMain,
  onSetGallery,
  onDelete,
  t,
}: {
  image: BusinessItemImage;
  busy: boolean;
  enhancing: boolean;
  borderRadius: number;
  hasRembg: boolean;
  hasEnhanced: boolean;
  hasVersions: boolean;
  activeVersion: ImageActiveVersion;
  showEnqueue?: boolean;
  pendingKind: ImageCleanupKind | null;
  aiTokensRemaining: number;
  onPendingKindChange: (kind: ImageCleanupKind | null) => void;
  onEnqueue: (kind: ImageCleanupKind) => void;
  onSetVersion: (version: ImageActiveVersion) => void;
  onSetMain: () => void;
  onSetGallery: () => void;
  onDelete: () => void;
  onPreview?: () => void;
  t: (key: string, def: string) => string;
}) {
  const { colors, spacing } = useTheme();
  const isMain = isPrimaryItemImageType(image.image_type);
  const statusLabel = isMain
    ? t('business.items.primary', 'Primary')
    : t('business.items.secondary', 'Secondary');

  const canRembg = !hasRembg;
  const canAi = !hasEnhanced;
  const showKindChips = showEnqueue && (canRembg || canAi);

  return (
    <Card
      style={[
        styles.card,
        {
          borderRadius,
          borderWidth: isMain ? 2 : StyleSheet.hairlineWidth,
          borderColor: isMain ? colors.primary.main : colors.divider,
        },
      ]}
      mode="elevated"
    >
      <Pressable
        style={styles.thumbWrap}
        onPress={onPreview}
        disabled={!onPreview}
        accessibilityRole={onPreview ? 'imagebutton' : undefined}
        accessibilityLabel={
          onPreview
            ? t('public.items.detail.viewFullImage', 'View full image')
            : undefined
        }
      >
        {busy && !enhancing ? (
          <View style={[styles.loader, { backgroundColor: colors.pageBackground }]}>
            <ActivityIndicator />
          </View>
        ) : (
          <Image source={{ uri: image.image_url }} style={styles.thumb} resizeMode="cover" />
        )}
        {enhancing ? (
          <View style={[styles.enhancingOverlay, { backgroundColor: colors.surface + 'CC' }]}>
            <ActivityIndicator color={colors.primary.main} />
            <StatusPill
              compact
              label={t('business.images.enhancement.enhancingBadge', 'Enhancing')}
              backgroundColor={colors.primary.main}
              textColor={colors.primary.contrast}
              icon="auto-fix"
              style={{ marginTop: 8 }}
            />
          </View>
        ) : null}
        <View style={styles.chipOverlay} pointerEvents="none">
          <ImageStatusChip isMain={isMain} label={statusLabel} />
        </View>
      </Pressable>
      <Card.Content style={styles.cardBody}>
        {hasVersions ? (
          <View style={{ marginBottom: spacing.sm }}>
            <ImageActiveVersionPicker
              value={activeVersion}
              hasRembg={hasRembg}
              hasEnhanced={hasEnhanced}
              disabled={busy || enhancing}
              onChange={onSetVersion}
            />
          </View>
        ) : null}
        {!isMain ? (
          <Button mode="contained-tonal" onPress={onSetMain} style={styles.btnFull} contentStyle={styles.btnContent}>
            {t('business.items.setAsPrimaryImage', 'Set as primary')}
          </Button>
        ) : (
          <Button mode="outlined" onPress={onSetGallery} style={styles.btnFull} contentStyle={styles.btnContent}>
            {t('business.items.setAsSecondaryImage', 'Set as secondary')}
          </Button>
        )}
        {showKindChips ? (
          <View style={{ marginBottom: spacing.sm }}>
            <ImageCleanupKindChips
              value={
                pendingKind ??
                (canRembg ? null : canAi ? null : null)
              }
              rembgDisabled={!canRembg}
              aiDisabled={!canAi || aiTokensRemaining <= 0}
              disabled={busy || enhancing || (!canRembg && !canAi)}
              onChange={(kind) => {
                if (kind === 'rembg' && !canRembg) return;
                if (kind === 'ai' && !canAi) return;
                onPendingKindChange(kind);
                if (kind) onEnqueue(kind);
              }}
            />
          </View>
        ) : null}
        <Button
          mode="text"
          textColor={colors.error.main}
          onPress={onDelete}
          style={[styles.btnFull, styles.btnDelete]}
          contentStyle={styles.btnContent}
        >
          {t('common.delete', 'Delete')}
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: {},
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  emptyHero: {
    width: '100%',
    aspectRatio: PHOTO_ASPECT,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pager: { alignItems: 'center', gap: 8 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  card: {
    width: '100%',
    alignSelf: 'stretch',
    marginVertical: 6,
    overflow: 'hidden',
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: PHOTO_ASPECT,
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  enhancingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    paddingHorizontal: 10,
    gap: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    marginVertical: 0,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  cardBody: { paddingTop: 12, paddingBottom: 12, paddingHorizontal: 12 },
  btnFull: { width: '100%', marginBottom: 8 },
  btnDelete: { marginBottom: 0 },
  btnContent: { width: '100%' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
