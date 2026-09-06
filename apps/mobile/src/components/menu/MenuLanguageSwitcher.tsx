import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../hooks/useLanguage';

const ICON_SIZE = 20;

/**
 * Language control for persona menus.
 * Designed to sit inside `UserMenuSection` — no nested card chrome.
 */
export const MenuLanguageSwitcher = memo(function MenuLanguageSwitcher() {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing } = useTheme();
  const { currentLanguage, changeLanguage, getAvailableLanguages } = useLanguage();

  const activeCode = currentLanguage.startsWith('en') ? 'en' : 'fr';

  const buttons = useMemo(
    () =>
      getAvailableLanguages().map((lang) => ({
        value: lang.code,
        label: `${lang.flag} ${lang.name}`,
        accessibilityLabel: lang.name,
      })),
    [getAvailableLanguages]
  );

  const onValueChange = useCallback(
    (value: string) => {
      if (value && value !== activeCode) void changeLanguage(value);
    },
    [activeCode, changeLanguage]
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
          <MaterialCommunityIcons name="translate" size={ICON_SIZE} color={colors.primary.main} />
        </View>
        <View style={styles.headerText}>
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {t('settings.language', 'Language')}
          </Text>
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}>
            {t('menuTab.languageSubtitle', 'App display language')}
          </Text>
        </View>
      </View>
      <SegmentedButtons
        value={activeCode}
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
