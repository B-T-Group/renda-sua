import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { businessApi } from '../../../services/businessApi';
import { uploadSingleBusinessImage } from '../../../services/businessImageUpload';
import { useTheme } from '../../../contexts/ThemeContext';
import { trackProductCreateEvent } from '../../../utils/productCreateAnalytics';
import {
  filterSupportedImageAssets,
  IMAGE_LIBRARY_PICKER_OPTIONS,
} from '../../../utils/supportedImageFormats';

export interface ProductEnrichmentNudgeProps {
  itemId: string;
  businessId?: string;
  photoCount: number;
  visible: boolean;
  onPhotoAdded?: () => void;
  onTagsApplied?: () => void;
  onDismissed?: () => void;
  onError?: (message: string) => void;
}

/**
 * Single post-publish enrichment prompt (max one per session).
 * Suggests adding a second photo or accepting AI tags.
 */
export function ProductEnrichmentNudge({
  itemId,
  businessId,
  photoCount,
  visible,
  onPhotoAdded,
  onTagsApplied,
  onDismissed,
  onError,
}: ProductEnrichmentNudgeProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'photo' | 'tags'>('photo');

  useEffect(() => {
    if (!visible || dismissed) return;
    setMode(photoCount < 2 ? 'photo' : 'tags');
    trackProductCreateEvent('product_create.enrichment_nudge_shown', {
      itemId,
      mode: photoCount < 2 ? 'photo' : 'tags',
    });
  }, [dismissed, itemId, photoCount, visible]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    onDismissed?.();
  }, [onDismissed]);

  const addPhoto = useCallback(async () => {
    if (!businessId) {
      onError?.(
        t(
          'business.onboarding.firstSale.upload.businessRequired',
          'Your business profile must be loaded before uploading photos.'
        )
      );
      return;
    }
    setBusy(true);
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        onError?.(
          t(
            'business.onboarding.firstSale.upload.photoPermissionDenied',
            'Photo library permission is required'
          )
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        ...IMAGE_LIBRARY_PICKER_OPTIONS,
        allowsMultipleSelection: false,
        base64: false,
      });
      if (result.canceled || !result.assets.length) return;
      const { supported } = filterSupportedImageAssets(result.assets);
      if (!supported.length) {
        onError?.(
          t(
            'business.images.upload.unsupportedFormat',
            'Some photos were skipped. Please use JPEG, PNG, or WebP.'
          )
        );
        return;
      }
      const imageId = await uploadSingleBusinessImage(supported[0], businessId);
      await businessApi.images.associateItem(imageId, itemId);
      trackProductCreateEvent('product_create.enrichment_nudge_accepted', {
        itemId,
        mode: 'photo',
      });
      onPhotoAdded?.();
      setDismissed(true);
    } catch (e: unknown) {
      onError?.(
        e instanceof Error
          ? e.message
          : t(
              'business.onboarding.firstSale.upload.error',
              'Failed to upload images'
            )
      );
    } finally {
      setBusy(false);
    }
  }, [businessId, itemId, onError, onPhotoAdded, t]);

  const acceptTags = useCallback(async () => {
    setBusy(true);
    try {
      const res = await businessApi.ai.itemRefinementSuggestions(itemId);
      if (!res.success) {
        throw new Error(
          t(
            'business.onboarding.firstSale.enrichment.tagsFailed',
            'Could not apply AI tags. Please try again.'
          )
        );
      }
      const tags = res.data?.suggestedTagsEn?.length
        ? res.data.suggestedTagsEn
        : res.data?.suggestedTagsFr ?? [];
      if (!tags.length) {
        onError?.(
          t(
            'business.onboarding.firstSale.enrichment.tagsFailed',
            'Could not apply AI tags. Please try again.'
          )
        );
        return;
      }
      await businessApi.catalog.setItemTags(itemId, tags.slice(0, 8));
      trackProductCreateEvent('product_create.enrichment_nudge_accepted', {
        itemId,
        mode: 'tags',
        tagCount: tags.length,
      });
      onTagsApplied?.();
      setDismissed(true);
    } catch (e: unknown) {
      onError?.(
        e instanceof Error
          ? e.message
          : t(
              'business.onboarding.firstSale.enrichment.tagsFailed',
              'Could not apply AI tags. Please try again.'
            )
      );
    } finally {
      setBusy(false);
    }
  }, [itemId, onError, onTagsApplied, t]);

  if (!visible || dismissed) return null;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginTop: spacing.md,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ color: colors.text.primary }}>
        {mode === 'photo'
          ? t(
              'business.onboarding.firstSale.enrichment.photoTitle',
              'Boost your listing'
            )
          : t(
              'business.onboarding.firstSale.enrichment.tagsTitle',
              'Add search tags with AI'
            )}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginTop: spacing.xs }}
      >
        {mode === 'photo'
          ? t(
              'business.onboarding.firstSale.enrichment.photoBody',
              'Add a second photo angle to improve quality and approval chances.'
            )
          : t(
              'business.onboarding.firstSale.enrichment.tagsBody',
              'We can suggest tags so customers find your product faster.'
            )}
      </Text>
      <View style={[styles.actions, { marginTop: spacing.sm, gap: spacing.sm }]}>
        <Button mode="text" onPress={dismiss} disabled={busy}>
          {t('common.dismiss', 'Not now')}
        </Button>
        {mode === 'photo' ? (
          <Button
            mode="contained"
            loading={busy}
            onPress={() => void addPhoto()}
          >
            {t(
              'business.onboarding.firstSale.enrichment.addPhoto',
              'Add photo'
            )}
          </Button>
        ) : (
          <Button
            mode="contained"
            loading={busy}
            onPress={() => void acceptTags()}
          >
            {t(
              'business.onboarding.firstSale.enrichment.applyTags',
              'Apply AI tags'
            )}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
