import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeMode } from '../../theme';

const ICON_SIZE = 20;

/**
 * Appearance (light / dark / system) control for persona menus.
 * Designed to sit inside `UserMenuSection` — no nested card chrome.
 */
export const MenuThemeSwitcher = memo(function MenuThemeSwitcher() {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing, mode, setMode } = useTheme();

  const buttons = useMemo(
    () => [
      {
        value: 'light',
        label: t('settings.themeLight', 'Light'),
        accessibilityLabel: t('settings.themeLight', 'Light'),
      },
      {
        value: 'dark',
        label: t('settings.themeDark', 'Dark'),
        accessibilityLabel: t('settings.themeDark', 'Dark'),
      },
      {
        value: 'system',
        label: t('settings.themeSystem', 'System'),
        accessibilityLabel: t('settings.themeSystem', 'System'),
      },
    ],
    [t]
  );

  const onValueChange = useCallback(
    (value: string) => {
      if (value === 'light' || value === 'dark' || value === 'system') {
        setMode(value as ThemeMode);
      }
    },
    [setMode]
  );

  return (
    <View style={[styles.block, { backgroundColor: colors.surface }]}>
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: colors.primaryTint,
              borderRadius: borderRadius.sm,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={mode === 'dark' ? 'weather-night' : 'theme-light-dark'}
            size={ICON_SIZE}
            color={colors.primary.main}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {t('settings.theme', 'Appearance')}
          </Text>
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}>
            {t('settings.themeSubtitle', 'Light, dark, or match device')}
          </Text>
        </View>
      </View>
      <SegmentedButtons
        value={mode}
        onValueChange={onValueChange}
        buttons={buttons}
        density="medium"
        style={{ marginTop: spacing.sm, width: '100%' }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
});
