import { memo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useImageFallback } from '../../hooks/useImageFallback';
import type { ItemVariant } from '../../types/business/itemVariant';
import { primaryVariantImageUrl } from '../../types/business/itemVariant';

export interface CatalogOptionChipsProps {
  options: ItemVariant[];
  value: string | null;
  onChange: (optionId: string) => void;
  disabled?: boolean;
}

function ChipThumb({ uri }: { uri: string | null }) {
  const { colors } = useTheme();
  const image = useImageFallback(uri);
  if (!image.hasImage || !image.sourceUri) {
    return (
      <View
        style={[
          styles.thumb,
          { backgroundColor: colors.pageBackground },
        ]}
      />
    );
  }
  return (
    <Image
      source={{ uri: image.sourceUri }}
      style={styles.thumb}
      resizeMode="cover"
      onError={image.onImageError}
    />
  );
}

function CatalogOptionChipsInner({
  options,
  value,
  onChange,
  disabled,
}: CatalogOptionChipsProps) {
  const { colors, typography, spacing, borderRadius } = useTheme();
  if (options.length === 0) return null;

  const useScroll = options.length > 4;

  const chips = options.map((option) => {
    const selected = option.id === value;
    const thumbUri = primaryVariantImageUrl(option);
    return (
      <Pressable
        key={option.id}
        disabled={disabled}
        onPress={() => onChange(option.id)}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: !!disabled }}
        accessibilityLabel={option.name}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: selected ? colors.primary.main : colors.divider,
            backgroundColor: selected
              ? colors.primary.light + '33'
              : colors.surface,
            borderRadius: borderRadius.md,
            opacity: pressed || disabled ? 0.72 : 1,
          },
        ]}
      >
        {thumbUri ? <ChipThumb uri={thumbUri} /> : null}
        <Text
          style={[
            typography.caption,
            {
              color: selected ? colors.primary.dark : colors.text.primary,
              fontWeight: selected ? '700' : '500',
              maxWidth: 88,
            },
          ]}
          numberOfLines={1}
        >
          {option.name}
        </Text>
      </Pressable>
    );
  });

  if (useScroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, { gap: spacing.xs, paddingRight: 4 }]}
        style={{ marginTop: spacing.xs }}
      >
        {chips}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.row, { gap: spacing.xs, marginTop: spacing.xs }]}>
      {chips}
    </View>
  );
}

export const CatalogOptionChips = memo(CatalogOptionChipsInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minHeight: 28,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
