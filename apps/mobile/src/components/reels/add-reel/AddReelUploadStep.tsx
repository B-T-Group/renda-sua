import React from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Button, Text, TextInput } from 'react-native-paper';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import { useTheme } from '@/contexts/ThemeContext';
import type { PickerProduct } from './addReelTypes';

type Props = {
  product: PickerProduct | null;
  caption: string;
  busy: boolean;
  onCaption: (value: string) => void;
  onUpload: () => void;
};

export function AddReelUploadStep({
  product,
  caption,
  busy,
  onCaption,
  onUpload,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: spacing.xl,
        gap: spacing.md,
      }}
    >
      <Text variant="titleLarge" style={{ color: colors.text.primary, fontWeight: '600' }}>
        {t('business.reels.add.uploadStepTitle', 'Upload your video')}
      </Text>
      <Text style={{ color: colors.text.secondary }}>
        {t(
          'business.reels.add.uploadStepSubtitle',
          'Choose a 15–30 second vertical clip linked to {{name}}.',
          { name: product?.name ?? t('business.reels.add.product', 'Product') }
        )}
      </Text>

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
          padding: spacing.md,
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <MaterialCommunityIcons
          name="video-vintage"
          size={40}
          color={colors.primary.main}
        />
        <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
          {t(
            'business.reels.add.uploadStepHint',
            'Portrait video · 15–30 seconds · clearly shows this product'
          )}
        </Text>
      </View>

      <TextInput
        mode="outlined"
        label={t('business.reels.add.caption', 'Caption (optional)')}
        value={caption}
        onChangeText={onCaption}
        maxLength={2200}
      />

      <Button
        mode="contained"
        loading={busy}
        disabled={busy || !product}
        onPress={onUpload}
        icon="upload"
      >
        {t('business.reels.add.upload', 'Upload from library (15–30s)')}
      </Button>
    </KeyboardAwareScrollView>
  );
}
