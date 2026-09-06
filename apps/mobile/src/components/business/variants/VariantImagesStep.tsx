import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Button, IconButton, Text } from 'react-native-paper';
import { ImageCleanupKindChips, ImageCleanupKindLegend } from '@/components/business/images/ImageCleanupKindChips';
import { useTheme } from '@/contexts/ThemeContext';
import type { ImageCleanupKindSelection } from '@/types/imageCleanup';
import type { ItemVariantImage } from '@/types/business/itemVariant';
import {
  canSelectAiCleanup,
  type CleanupKindsByIndex,
} from '@/utils/imageCleanupKinds';
import {
  filterSupportedImageAssets,
  IMAGE_LIBRARY_PICKER_OPTIONS,
} from '@/utils/supportedImageFormats';

interface Props {
  existingImages: ItemVariantImage[];
  selectedAssets: ImagePicker.ImagePickerAsset[];
  onSelectedAssetsChange: (assets: ImagePicker.ImagePickerAsset[]) => void;
  onDeleteExisting: (imageId: string) => void;
  onUnsupportedFormat?: () => void;
  aiTokens?: number;
  cleanupKinds?: CleanupKindsByIndex;
  onCleanupKindChange?: (
    index: number,
    kind: ImageCleanupKindSelection
  ) => void;
}

export function VariantImagesStep({
  existingImages,
  selectedAssets,
  onSelectedAssetsChange,
  onDeleteExisting,
  onUnsupportedFormat,
  aiTokens = 0,
  cleanupKinds = {},
  onCleanupKindChange,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const showChips = !!onCleanupKindChange;

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      ...IMAGE_LIBRARY_PICKER_OPTIONS,
      allowsMultipleSelection: true,
    });
    if (result.canceled) return;
    const { supported, rejectedCount } = filterSupportedImageAssets(result.assets);
    if (rejectedCount > 0) onUnsupportedFormat?.();
    if (supported.length) {
      onSelectedAssetsChange([...selectedAssets, ...supported]);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      ...IMAGE_LIBRARY_PICKER_OPTIONS,
    });
    if (result.canceled || !result.assets.length) return;
    const { supported, rejectedCount } = filterSupportedImageAssets(result.assets);
    if (rejectedCount > 0) onUnsupportedFormat?.();
    if (supported.length) {
      onSelectedAssetsChange([...selectedAssets, ...supported]);
    }
  };

  return (
    <View>
      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
        {t('business.variants.imagesHint', 'Add photos specific to this option.')}
      </Text>
      {showChips && selectedAssets.length > 0 ? (
        <View style={{ marginBottom: spacing.sm }}>
          <ImageCleanupKindLegend />
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginTop: spacing.sm }}
          >
            {t(
              'business.images.cleanupKinds.tokensRemaining',
              '{{count}} AI tokens remaining',
              {
                count: Math.max(
                  0,
                  aiTokens -
                    Object.values(cleanupKinds).filter((k) => k === 'ai').length
                ),
              }
            )}
          </Text>
        </View>
      ) : null}
      <View style={[styles.pickRow, { gap: spacing.sm, marginBottom: spacing.sm }]}>
        <Button mode="outlined" icon="image-plus" onPress={() => void pickImages()} style={styles.pickBtn}>
          {t('business.variants.addImages', 'Add photos')}
        </Button>
        <Button mode="outlined" icon="camera" onPress={() => void takePhoto()} style={styles.pickBtn}>
          {t('business.variants.takePhoto', 'Take photo')}
        </Button>
      </View>
      <ScrollView horizontal contentContainerStyle={[styles.row, { paddingVertical: spacing.md }]}>
        {existingImages.map((image) => (
          <View key={image.id} style={styles.imageWrap}>
            <Image
              source={{ uri: image.image_url }}
              resizeMode="cover"
              style={[styles.image, { borderRadius: borderRadius.md }]}
            />
            <IconButton
              icon="close"
              size={18}
              mode="contained"
              style={styles.remove}
              onPress={() => onDeleteExisting(image.id)}
              accessibilityLabel={t('common.delete', 'Delete')}
            />
          </View>
        ))}
        {selectedAssets.map((asset, index) => (
          <View key={`new-${asset.uri}-${index}`} style={styles.newTile}>
            <View style={styles.imageWrap}>
              <Image
                source={{ uri: asset.uri }}
                resizeMode="cover"
                style={[styles.image, { borderRadius: borderRadius.md }]}
              />
              <IconButton
                icon="close"
                size={18}
                mode="contained"
                style={styles.remove}
                onPress={() =>
                  onSelectedAssetsChange(selectedAssets.filter((_, i) => i !== index))
                }
                accessibilityLabel={t('common.delete', 'Delete')}
              />
            </View>
            {showChips ? (
              <ImageCleanupKindChips
                value={cleanupKinds[index] ?? null}
                aiDisabled={!canSelectAiCleanup(aiTokens, cleanupKinds, index)}
                onChange={(kind) => onCleanupKindChange?.(index, kind)}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>
      {existingImages.length === 0 && selectedAssets.length === 0 ? (
        <Text style={{ color: colors.text.secondary, marginTop: spacing.md }}>
          {t('business.variants.noImages', 'No variant photos yet')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pickRow: { flexDirection: 'row', flexWrap: 'wrap' },
  pickBtn: { borderRadius: 12 },
  row: { gap: 10 },
  imageWrap: { position: 'relative' },
  newTile: { width: 168 },
  image: { width: 168, height: 168 },
  remove: { position: 'absolute', top: -8, right: -8 },
});
