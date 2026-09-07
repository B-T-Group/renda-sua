import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import type { HeroSlideConfig } from './heroSlideConfig';

type Props = {
  slide: HeroSlideConfig;
  width: number;
  onPress: () => void;
};

export function HeroCarouselSlide({ slide, width, onPress }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(slide.titleKey, slide.titleDefault)}
      style={[styles.wrap, { width }]}
    >
      <View
        style={[
          styles.inner,
          {
            backgroundColor: colors.surface + 'AA',
            borderRadius: borderRadius.md,
            borderColor: colors.primary.main + '22',
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            gap: spacing.xs,
            marginHorizontal: 0,
          },
        ]}
      >
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryTint }]}>
            <MaterialCommunityIcons
              name={slide.icon}
              size={20}
              color={colors.primary.main}
            />
          </View>
          <View style={styles.textCol}>
            <Text
              variant="titleSmall"
              style={{ color: colors.text.primary, fontWeight: '700' }}
              numberOfLines={2}
            >
              {t(slide.titleKey, slide.titleDefault)}
            </Text>
            <Text
              variant="labelMedium"
              style={{ color: colors.primary.main, fontWeight: '600', marginTop: 2 }}
            >
              {t(slide.ctaKey, slide.ctaDefault)}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.primary.main}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  inner: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
});
