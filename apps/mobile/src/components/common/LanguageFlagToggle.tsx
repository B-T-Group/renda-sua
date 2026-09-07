import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Portal } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../hooks/useLanguage';

export interface LanguageFlagToggleProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact segmented language switcher: a single pill track containing one
 * flag + language-code segment per language. The active segment is lifted
 * with a primary tint; inactive segments are desaturated (grayscale on web,
 * faded on native). Works on both iOS and Android.
 */
export function LanguageFlagToggle({ style }: LanguageFlagToggleProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { currentLanguage, changeLanguage, getAvailableLanguages } = useLanguage();
  const languages = getAvailableLanguages();
  const [switching, setSwitching] = useState(false);

  const handleSelect = async (code: string) => {
    setSwitching(true);
    try {
      await changeLanguage(code);
      await new Promise((resolve) => setTimeout(resolve, 600));
    } finally {
      setSwitching(false);
    }
  };

  return (
    <View
      style={[
        styles.track,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.full,
        },
        style,
      ]}
    >
      {languages.map((lang) => {
        const selected = (currentLanguage ?? '').toLowerCase().startsWith(lang.code);
        return (
          <Pressable
            key={lang.code}
            onPress={() => {
              if (!selected && !switching) void handleSelect(lang.code);
            }}
            accessibilityRole="button"
            accessibilityLabel={lang.name}
            accessibilityState={{ selected }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.segment,
              {
                paddingHorizontal: spacing.sm,
                borderRadius: borderRadius.full,
                backgroundColor: selected ? colors.primaryTint : 'transparent',
                opacity: pressed && !selected ? 0.6 : 1,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.flag, selected ? null : styles.flagInactive]}
            >
              {lang.flag}
            </Text>
            <Text
              allowFontScaling={false}
              style={[
                styles.code,
                typography.caption as TextStyle,
                selected
                  ? { color: colors.primary.main, fontWeight: '700' }
                  : { color: colors.text.secondary },
              ]}
            >
              {lang.code.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}

      {switching ? (
        <Portal>
          <View style={[styles.overlay, { backgroundColor: `${colors.pageBackground}E6`, gap: spacing.md }]}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={[styles.overlayText, typography.body2 as TextStyle, { color: colors.text.primary }]}>
              {t('common.switchingLanguage', 'Switching language…')}
            </Text>
          </View>
        </Portal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    padding: 3,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 30,
  },
  flag: { fontSize: 16, lineHeight: 20 },
  flagInactive:
    Platform.OS === 'web'
      ? ({ filter: 'grayscale(100%)', opacity: 0.5 } as unknown as ViewStyle)
      : { opacity: 0.45 },
  code: { letterSpacing: 0.5 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  overlayText: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
