import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageCleanupKindChips, ImageCleanupKindLegend } from '../images/ImageCleanupKindChips';
import { useTheme } from '../../../contexts/ThemeContext';
import { ProductPhotoTipsIllustration } from '../../illustrations/ProductPhotoTipsIllustration';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';
import { StatusPill } from '../../common/StatusPill';
import type { ImageCleanupKindSelection } from '../../../types/imageCleanup';
import type { ImageValidationResult } from '../../../types/imageValidation';
import {
  aiTokensRemainingAfterSelections,
  canSelectAiCleanup,
  type CleanupKindsByIndex,
} from '../../../utils/imageCleanupKinds';
import { PhotoAngleGuidelines } from './PhotoAngleGuidelines';

export interface AddItemUploadStepProps {
  assets: ImagePickerAsset[];
  busy: boolean;
  profileLoading: boolean;
  canContinue: boolean;
  minPhotos?: number;
  /** Optional per-photo validation (used by rental wizard). */
  validationResults?: ImageValidationResult[];
  aiTokens?: number;
  cleanupKinds?: CleanupKindsByIndex;
  onCleanupKindChange?: (
    index: number,
    kind: ImageCleanupKindSelection
  ) => void;
  onBuyTokens?: () => void;
  onPick: () => void;
  onTakePhoto: () => void;
  onRemove: (index: number) => void;
  onSetMain: (index: number) => void;
  onContinue: () => void;
}

export function AddItemUploadStep({
  assets,
  busy,
  profileLoading,
  canContinue,
  minPhotos = 1,
  validationResults = [],
  aiTokens = 0,
  cleanupKinds = {},
  onCleanupKindChange,
  onBuyTokens,
  onPick,
  onTakePhoto,
  onRemove,
  onSetMain,
  onContinue,
}: AddItemUploadStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewAsset = previewIndex !== null ? assets[previewIndex] : null;
  const showCleanupChips = !!onCleanupKindChange;
  const hasPhotos = assets.length > 0;
  const tokensLeft = aiTokensRemainingAfterSelections(aiTokens, cleanupKinds);
  const contentPad = 16;
  const gridInnerWidth = width - contentPad * 2;
  // One photo: full width so labels fit; multiple: two columns.
  const tileSize =
    assets.length <= 1
      ? gridInnerWidth
      : Math.floor((gridInnerWidth - TILE_GAP) / 2);
  const minPhotosLabel =
    minPhotos === 1
      ? t(
          'business.onboarding.firstSale.upload.minPhotosOne',
          'At least 1 photo is required to continue.'
        )
      : t(
          'business.onboarding.firstSale.upload.minPhotosMany',
          'At least {{count}} photos are required to continue.',
          { count: minPhotos }
        );

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, spacing.lg) + 24 },
      ]}
    >
      {!hasPhotos ? (
        <View style={styles.hero}>
          <ProductPhotoTipsIllustration size={172} />
          <Text
            variant="headlineSmall"
            style={[styles.heroTitle, { color: colors.text.primary }]}
          >
            {t(
              'business.onboarding.firstSale.upload.heroTitle',
              'Show your product clearly'
            )}
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              color: colors.text.secondary,
              textAlign: 'center',
              marginBottom: spacing.md,
            }}
          >
            {t(
              'business.onboarding.firstSale.upload.hintAdditional',
              'Take or choose photos — we upload them instantly and fill the listing for you.'
            )}
          </Text>
        </View>
      ) : (
        <Text
          variant="bodyMedium"
          style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
        >
          {t(
            'business.onboarding.firstSale.upload.hintWithPhotos',
            'Add more angles if you can. The main photo is used for your listing cover.'
          )}
        </Text>
      )}

      <PhotoAngleGuidelines compact={hasPhotos} />

      {!hasPhotos ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginBottom: spacing.md }}
        >
          {minPhotosLabel}
        </Text>
      ) : null}

      {hasPhotos && showCleanupChips ? (
        <View
          style={[
            styles.cleanupBanner,
            {
              backgroundColor: colors.primaryTint,
              borderColor: colors.primary.main + '33',
              marginBottom: spacing.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text
            variant="titleSmall"
            style={{ color: colors.text.primary, fontWeight: '700' }}
          >
            {t(
              'business.images.cleanupKinds.chooseTitle',
              'Improve each photo (optional)'
            )}
          </Text>
          <ImageCleanupKindLegend />
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginTop: spacing.sm }}
          >
            {t(
              'business.images.cleanupKinds.tokensRemaining',
              '{{count}} AI tokens remaining',
              { count: tokensLeft }
            )}
          </Text>
          {aiTokens <= 0 && onBuyTokens ? (
            <Button
              mode="text"
              compact
              onPress={onBuyTokens}
              style={{ alignSelf: 'flex-start', marginLeft: -8, marginTop: 4 }}
            >
              {t('business.images.asyncCleanup.buyTokens', 'Buy AI tokens')}
            </Button>
          ) : null}
        </View>
      ) : null}

      {hasPhotos ? (
        <>
          <View style={[styles.grid, { gap: TILE_GAP }]}>
            {assets.map((asset, index) => (
              <View
                key={`${asset.uri}-${index}`}
                style={{ width: tileSize }}
              >
                <Pressable
                  style={{ width: tileSize, position: 'relative' }}
                  onPress={() => setPreviewIndex(index)}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'business.onboarding.firstSale.upload.previewPhoto',
                    'Preview photo {{n}}',
                    { n: index + 1 }
                  )}
                >
                  <Image
                    source={{ uri: asset.uri }}
                    style={{
                      width: tileSize,
                      height: tileSize,
                      borderRadius: 12,
                    }}
                  />
                  {validationResults[index]?.errors?.length ? (
                    <StatusPill
                      compact
                      label={t('common.error', 'Error')}
                      backgroundColor={colors.error.main + '22'}
                      textColor={colors.error.main}
                      icon="alert-circle-outline"
                      style={styles.mainChip}
                    />
                  ) : null}
                  {index === 0 ? (
                    <StatusPill
                      compact
                      label={t(
                        'business.onboarding.firstSale.upload.mainPhoto',
                        'Main'
                      )}
                      backgroundColor={colors.primaryTint}
                      textColor={colors.primary.main}
                      icon="star-outline"
                      style={styles.mainChip}
                    />
                  ) : (
                    <Pressable
                      onPress={() => onSetMain(index)}
                      style={styles.setMainBtn}
                    >
                      <Text
                        variant="labelSmall"
                        style={{ color: colors.primary.main }}
                      >
                        {t(
                          'business.onboarding.firstSale.upload.setAsMain',
                          'Set as main'
                        )}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => onRemove(index)}
                    style={styles.removeBtn}
                  >
                    <Text
                      variant="labelSmall"
                      style={{ color: colors.primary.contrast }}
                    >
                      ×
                    </Text>
                  </Pressable>
                </Pressable>
                {showCleanupChips ? (
                  <ImageCleanupKindChips
                    value={cleanupKinds[index] ?? null}
                    disabled={busy}
                    aiDisabled={!canSelectAiCleanup(aiTokens, cleanupKinds, index)}
                    onChange={(kind) => onCleanupKindChange?.(index, kind)}
                  />
                ) : null}
              </View>
            ))}
          </View>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginBottom: spacing.md }}
          >
            {t(
              'business.onboarding.firstSale.upload.previewHint',
              'Tap a photo to preview it full size.'
            )}
          </Text>
        </>
      ) : null}

      <View style={styles.actionsColumn}>
        <Button
          mode={hasPhotos ? 'outlined' : 'contained'}
          icon="camera"
          onPress={onTakePhoto}
          disabled={busy}
          style={styles.actionBtn}
          contentStyle={styles.actionBtnContent}
        >
          {t('business.onboarding.firstSale.upload.takePhoto', 'Take a photo')}
        </Button>
        <Button
          mode="outlined"
          icon="image-plus"
          onPress={onPick}
          disabled={busy}
          style={styles.actionBtn}
          contentStyle={styles.actionBtnContent}
        >
          {t(
            'business.onboarding.firstSale.upload.chooseFiles',
            'Choose images'
          )}
        </Button>
        {hasPhotos ? (
          <Button
            mode="contained"
            disabled={!canContinue}
            onPress={onContinue}
            style={styles.actionBtn}
            contentStyle={styles.actionBtnContent}
          >
            {profileLoading
              ? t('common.loading', 'Loading…')
              : t('common.continue', 'Continue')}
          </Button>
        ) : null}
      </View>

      <Modal
        visible={previewIndex !== null && !!previewAsset}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewIndex(null)}
        statusBarTranslucent
      >
        <View
          style={[
            styles.modalOverlay,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <Pressable
            style={[styles.modalClose, { top: insets.top + 12 }]}
            onPress={() => setPreviewIndex(null)}
          >
            <Text style={styles.modalCloseText}>✕</Text>
          </Pressable>
          {previewAsset ? (
            <Image
              source={{ uri: previewAsset.uri }}
              style={{ width, height: height - insets.top - insets.bottom }}
              resizeMode="contain"
            />
          ) : null}
          {previewIndex !== null && assets[previewIndex] ? (
            <View style={styles.modalActions}>
              {previewIndex > 0 ? (
                <Button
                  mode="contained"
                  onPress={() => {
                    onSetMain(previewIndex);
                    setPreviewIndex(null);
                  }}
                  style={{ marginRight: 8 }}
                >
                  {t(
                    'business.onboarding.firstSale.upload.setAsMain',
                    'Set as main'
                  )}
                </Button>
              ) : null}
              <Button
                mode="outlined"
                onPress={() => {
                  onRemove(previewIndex);
                  setPreviewIndex(null);
                }}
                textColor={colors.error?.main ?? '#f44336'}
              >
                {t('common.remove', 'Remove')}
              </Button>
            </View>
          ) : null}
        </View>
      </Modal>
    </KeyboardAwareScrollView>
  );
}

const TILE_GAP = 12;

const styles = StyleSheet.create({
  content: { padding: 16 },
  hero: { alignItems: 'center', marginBottom: 4 },
  heroTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  cleanupBanner: {
    borderWidth: 1,
    borderRadius: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  mainChip: { position: 'absolute', top: 4, left: 4 },
  setMainBtn: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 2,
    borderRadius: 4,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsColumn: { gap: 12, marginTop: 8 },
  actionBtn: { width: '100%', minHeight: 48 },
  actionBtnContent: { width: '100%' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  modalActions: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
