import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import { useTheme } from '@/contexts/ThemeContext';
import type { AddReelMode, PickerProduct } from './addReelTypes';

type Props = {
  mode: AddReelMode;
  products: PickerProduct[];
  selected: PickerProduct | null;
  loading: boolean;
  onSelect: (product: PickerProduct) => void;
  onContinue: () => void;
  onAddProduct?: () => void;
};

export function AddReelProductStep({
  mode,
  products,
  selected,
  loading,
  onSelect,
  onContinue,
  onAddProduct,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const needsPhoto = mode === 'ai';
  const hasPhoto = Boolean(selected?.imageUrl);
  const canContinue = Boolean(selected) && (!needsPhoto || hasPhoto);

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: spacing.xl,
        gap: spacing.md,
      }}
    >
      <Text variant="titleLarge" style={{ color: colors.text.primary, fontWeight: '600' }}>
        {t('business.reels.add.productStepTitle', 'Choose a product')}
      </Text>
      <Text style={{ color: colors.text.secondary }}>
        {mode === 'ai'
          ? t(
              'business.reels.add.productStepAiHint',
              'Pick the product for your AI ad. It needs at least one photo.'
            )
          : t(
              'business.reels.add.productStepUploadHint',
              'Pick the product this video is about.'
            )}
      </Text>

      {loading ? <ActivityIndicator color={colors.primary.main} /> : null}

      {!loading && products.length === 0 ? (
        <View style={{ gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.lg }}>
          <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
            {t(
              'business.reels.add.emptyCatalog',
              'No products yet. Add a product with photos first.'
            )}
          </Text>
          {onAddProduct ? (
            <Button mode="contained" onPress={onAddProduct}>
              {t('business.reels.add.addProduct', 'Add a product')}
            </Button>
          ) : null}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {products.map((product) => {
              const active = selected?.subjectId === product.subjectId;
              return (
                <Pressable
                  key={`${product.subjectType}-${product.subjectId}`}
                  onPress={() => onSelect(product)}
                  style={[
                    styles.productCard,
                    {
                      borderColor: active ? colors.primary.main : colors.divider,
                      backgroundColor: colors.background.paper,
                    },
                  ]}
                >
                  {product.imageUrl ? (
                    <Image source={{ uri: product.imageUrl }} style={styles.thumb} />
                  ) : (
                    <View
                      style={[
                        styles.thumb,
                        {
                          backgroundColor: colors.divider,
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                      ]}
                    >
                      <Text variant="labelSmall">
                        {t('business.reels.add.noPhoto', 'No photo')}
                      </Text>
                    </View>
                  )}
                  <Text numberOfLines={2} style={{ color: colors.text.primary, fontSize: 12 }}>
                    {product.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {selected && needsPhoto && !hasPhoto ? (
        <Text style={{ color: colors.error.main }}>
          {t(
            'business.reels.add.needPhoto',
            'Add at least one product photo before generating'
          )}
        </Text>
      ) : null}

      <Button mode="contained" disabled={!canContinue} onPress={onContinue}>
        {t('business.reels.add.continue', 'Continue')}
      </Button>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  productCard: {
    width: 112,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    gap: 6,
  },
  thumb: { width: '100%', height: 72, borderRadius: 8 },
});
