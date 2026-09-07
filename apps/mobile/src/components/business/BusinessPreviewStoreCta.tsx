import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  onPress: () => void;
}

/**
 * Compact secondary action — preview is infrequent, so keep it out of the hero.
 */
export function BusinessPreviewStoreCta({ visible, onPress }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  if (!visible) return null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('stores.previewCtaButton', 'Preview store')}
      hitSlop={8}
      style={({ pressed }) => [
        styles.row,
        {
          marginTop: spacing.xs,
          marginBottom: spacing.md,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons
        name="storefront-outline"
        size={18}
        color={colors.primary.main}
        style={{ marginRight: 6 }}
      />
      <Text variant="bodyMedium" style={{ color: colors.primary.main, fontWeight: '600' }}>
        {t('stores.previewCtaButton', 'Preview store')}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.primary.main, marginLeft: 4 }}>
        →
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 40,
  },
});
