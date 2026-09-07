import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Divider, IconButton, Menu } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../hooks/useLanguage';

type AuthSettingsMenuProps = {
  onAboutPress: () => void;
};

/** Top-left login/signup menu: language + About (no env switch). */
export function AuthSettingsMenu({ onAboutPress }: AuthSettingsMenuProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentLanguage, changeLanguage, getAvailableLanguages } = useLanguage();
  const [open, setOpen] = useState(false);

  const pickLanguage = useCallback(
    async (code: string) => {
      await changeLanguage(code);
      setOpen(false);
    },
    [changeLanguage]
  );

  const openAbout = useCallback(() => {
    setOpen(false);
    onAboutPress();
  }, [onAboutPress]);

  return (
    <View style={[styles.anchor, { top: insets.top + 4, left: 8 + insets.left }]}>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchor={
          <IconButton
            icon="cog-outline"
            mode="contained-tonal"
            onPress={() => setOpen(true)}
            accessibilityLabel={t('auth.loginSettingsMenu.a11y', 'Language and about')}
          />
        }
      >
        <Menu.Item
          disabled
          title={t('settings.language', 'Language')}
          titleStyle={{ color: colors.text.secondary, fontSize: 12 }}
        />
        {getAvailableLanguages().map((lang) => (
          <Menu.Item
            key={lang.code}
            onPress={() => void pickLanguage(lang.code)}
            title={`${lang.flag}  ${lang.name}`}
            leadingIcon={currentLanguage.startsWith(lang.code) ? 'check' : undefined}
          />
        ))}
        <Divider />
        <Menu.Item
          onPress={openAbout}
          title={t('about.title', 'About')}
          leadingIcon="information-outline"
        />
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    zIndex: 10,
  },
});
