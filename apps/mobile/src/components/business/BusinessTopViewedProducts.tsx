import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { TopViewedProduct } from '../../types/business/dashboard';

export interface BusinessTopViewedProductsProps {
  products: TopViewedProduct[];
  loading: boolean;
  onProductPress?: (product: TopViewedProduct) => void;
}

export function BusinessTopViewedProducts({
  products,
  loading,
  onProductPress,
}: BusinessTopViewedProductsProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();

  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          marginBottom: spacing.md,
          padding: spacing.md,
        },
      ]}
    >
      <Text
        variant="labelSmall"
        style={{ color: colors.text.secondary, letterSpacing: 0.4, marginBottom: 8 }}
      >
        {t('business.dashboard.topViewed.title', 'Top viewed products')}
      </Text>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary.main}
          style={{ alignSelf: 'flex-start', marginVertical: 8 }}
        />
      ) : (
        products.map((product, index) => (
          <TopViewedRow
            key={product.itemId}
            product={product}
            rank={index + 1}
            onPress={onProductPress}
          />
        ))
      )}
    </View>
  );
}

function TopViewedRow({
  product,
  rank,
  onPress,
}: {
  product: TopViewedProduct;
  rank: number;
  onPress?: (product: TopViewedProduct) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const clickable = Boolean(onPress && product.itemId);

  const content = (
    <>
      <Text
        variant="labelLarge"
        style={{ width: 22, color: colors.text.secondary, fontWeight: '700' }}
      >
        {rank}
      </Text>
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          style={[styles.thumb, { borderRadius: borderRadius.sm }]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.thumb,
            {
              borderRadius: borderRadius.sm,
              backgroundColor: colors.primary.hover,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <MaterialCommunityIcons
            name="package-variant"
            size={20}
            color={colors.text.secondary}
          />
        </View>
      )}
      <View style={styles.textCol}>
        <Text
          variant="titleSmall"
          numberOfLines={1}
          style={{ color: colors.text.primary, fontWeight: '600' }}
        >
          {product.itemName}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t('business.dashboard.topViewed.views', '{{count}} views', {
            count: product.viewsCount,
          })}
        </Text>
      </View>
      {clickable ? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={colors.text.secondary}
        />
      ) : null}
    </>
  );

  if (!clickable) {
    return <View style={[styles.row, { marginBottom: spacing.sm }]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={() => onPress?.(product)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { marginBottom: spacing.sm, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  thumb: { width: 40, height: 40 },
  textCol: { flex: 1, minWidth: 0 },
});
