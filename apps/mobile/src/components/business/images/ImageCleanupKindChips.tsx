import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Text } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';
import type { ImageCleanupKindSelection } from '@/types/imageCleanup';

const CLEANUP_KIND_ICONS = {
  rembg: 'image-off-outline',
  ai: 'auto-fix',
} as const;

type ChipProps = {
  value: ImageCleanupKindSelection;
  rembgDisabled?: boolean;
  aiDisabled?: boolean;
  disabled?: boolean;
  onChange: (next: ImageCleanupKindSelection) => void;
};

/**
 * Stacked rembg / AI cleanup toggles with icon + label under each photo.
 */
export function ImageCleanupKindChips({
  value,
  rembgDisabled = false,
  aiDisabled = false,
  disabled = false,
  onChange,
}: ChipProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  const rembgSelected = value === 'rembg';
  const aiSelected = value === 'ai';

  return (
    <View style={[styles.stack, { marginTop: spacing.sm, gap: spacing.xs }]}>
      <LabeledToggle
        icon={CLEANUP_KIND_ICONS.rembg}
        title={t('business.images.cleanupKinds.removeBg', 'Remove background')}
        detail={t('business.images.cleanupKinds.free', 'Free')}
        selected={rembgSelected}
        disabled={disabled || (rembgDisabled && !rembgSelected)}
        onPress={() => onChange(rembgSelected ? null : 'rembg')}
        colors={colors}
        radius={borderRadius.md}
      />
      <LabeledToggle
        icon={CLEANUP_KIND_ICONS.ai}
        title={t('business.images.cleanupKinds.aiCleanup', 'AI cleanup')}
        detail={t('business.images.cleanupKinds.aiCostHint', '1 token')}
        selected={aiSelected}
        disabled={disabled || (aiDisabled && !aiSelected)}
        onPress={() => onChange(aiSelected ? null : 'ai')}
        colors={colors}
        radius={borderRadius.md}
      />
    </View>
  );
}

/** Short hint above the photo grid (buttons under each photo are labeled). */
export function ImageCleanupKindLegend() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  return (
    <Text
      variant="bodySmall"
      style={{ color: colors.text.secondary, marginTop: spacing.sm }}
    >
      {t(
        'business.images.cleanupKinds.chooseHint',
        'Choose Remove background (free) or AI cleanup (1 token) under each photo. Tap again to clear.'
      )}
    </Text>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function togglePalette(colors: ThemeColors, selected: boolean, disabled: boolean) {
  return {
    bg: selected ? colors.primary.main : colors.background.paper,
    fg: selected
      ? colors.primary.contrast
      : disabled
        ? colors.text.disabled
        : colors.text.primary,
    muted: selected ? colors.primary.contrast : colors.text.secondary,
    border: selected ? colors.primary.main : colors.divider,
  };
}

function LabeledToggle({
  icon,
  title,
  detail,
  selected,
  disabled,
  onPress,
  colors,
  radius,
}: {
  icon: string;
  title: string;
  detail: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: ThemeColors;
  radius: number;
}) {
  const pal = togglePalette(colors, selected, disabled);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityState={{ selected, disabled }}
      style={[
        styles.toggle,
        {
          backgroundColor: pal.bg,
          borderColor: pal.border,
          borderRadius: radius,
          opacity: disabled && !selected ? 0.5 : 1,
        },
      ]}
    >
      <Icon source={icon} size={22} color={pal.fg} />
      <View style={styles.toggleCopy}>
        <Text
          variant="labelLarge"
          numberOfLines={2}
          style={{ color: pal.fg, fontWeight: '700' }}
        >
          {title}
        </Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ color: pal.muted }}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: '100%',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
  },
  toggleCopy: {
    flex: 1,
    minWidth: 0,
  },
});
