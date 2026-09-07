import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';
import type { ImageActiveVersion } from '@/types/imageCleanup';

type Props = {
  value: ImageActiveVersion;
  hasRembg: boolean;
  hasEnhanced: boolean;
  disabled?: boolean;
  onChange: (version: ImageActiveVersion) => void;
};

/** Three-segment live version picker: Original | No bg | AI. */
export function ImageActiveVersionPicker({
  value,
  hasRembg,
  hasEnhanced,
  disabled = false,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();

  const segments: Array<{
    version: ImageActiveVersion;
    label: string;
    available: boolean;
  }> = [
    {
      version: 'original',
      label: t('business.images.versions.original', 'Original'),
      available: true,
    },
    {
      version: 'rembg',
      label: t('business.images.versions.noBg', 'No bg'),
      available: hasRembg,
    },
    {
      version: 'enhanced',
      label: t('business.images.versions.ai', 'AI'),
      available: hasEnhanced,
    },
  ];

  return (
    <View
      style={[
        styles.row,
        {
          borderColor: colors.divider,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.pageBackground,
        },
      ]}
    >
      {segments.map((seg) => {
        const selected = value === seg.version;
        const inactive = disabled || !seg.available;
        return (
          <Pressable
            key={seg.version}
            disabled={inactive}
            onPress={() => onChange(seg.version)}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: inactive }}
            style={[
              styles.segment,
              {
                backgroundColor: selected
                  ? colors.primary.main
                  : 'transparent',
                opacity: !seg.available ? 0.4 : 1,
              },
            ]}
          >
            <Text
              variant="labelSmall"
              numberOfLines={1}
              style={{
                color: selected
                  ? colors.primary.contrast
                  : colors.text.secondary,
                fontWeight: '600',
                fontSize: 11,
                textAlign: 'center',
              }}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  segment: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
