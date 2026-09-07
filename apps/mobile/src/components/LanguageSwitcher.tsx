import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppModal } from './common/AppModal';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks/useLanguage';

type Variant = 'compact' | 'full';

type Props = {
  variant?: Variant;
};

/**
 * Affiche la langue actuelle et permet d'ouvrir un modal pour choisir FR / EN.
 * - compact : une ligne avec icône + libellé, pour Login ou header
 * - full : une carte plus large pour Profil
 */
export default function LanguageSwitcher({ variant = 'full' }: Props) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const { currentLanguage, changeLanguage, getAvailableLanguages } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  const languages = getAvailableLanguages();
  const current = languages.find((l) => l.code === currentLanguage) ?? languages[0];

  const selectLanguage = async (code: string) => {
    await changeLanguage(code);
    setModalVisible(false);
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          variant === 'compact' ? styles.compactRow : styles.fullRow,
          {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderColor: colors.divider,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={t('settings.language')}
      >
        <MaterialCommunityIcons name="translate" size={variant === 'compact' ? 20 : 24} color={colors.primary.main} />
        <Text style={[variant === 'compact' ? styles.compactLabel : styles.fullLabel, { color: colors.text.primary }, typography.body2 as any]}>
          {variant === 'compact' ? current.name : t('settings.language')}
        </Text>
        {variant === 'full' && (
          <Text style={[styles.currentValue, { color: colors.text.secondary }, typography.caption as any]}>
            {current.name} {current.flag}
          </Text>
        )}
        <MaterialCommunityIcons name="chevron-down" size={20} color={colors.text.secondary} />
      </Pressable>

      <AppModal visible={modalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.modalBox, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }, typography.subtitle1 as any]}>
              {t('settings.chooseLanguage')}
            </Text>
            {languages.map((lang) => (
              <Pressable
                key={lang.code}
                style={({ pressed }) => [
                  styles.langOption,
                  {
                    backgroundColor: currentLanguage === lang.code ? colors.primaryTint : 'transparent',
                    borderRadius: borderRadius.md,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => selectLanguage(lang.code)}
              >
                <Text style={[styles.langFlag]}>{lang.flag}</Text>
                <Text style={[styles.langName, { color: colors.text.primary }, typography.body2 as any]}>{lang.name}</Text>
                {currentLanguage === lang.code && (
                  <MaterialCommunityIcons name="check-circle" size={22} color={colors.primary.main} />
                )}
              </Pressable>
            ))}
            <Pressable
              style={[styles.cancelBtn, { borderColor: colors.divider }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.cancelText, { color: colors.text.secondary }, typography.button as any]}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
  },
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderWidth: 1,
  },
  compactLabel: {},
  fullLabel: { flex: 1 },
  currentValue: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: { padding: 20 },
  modalTitle: { marginBottom: 16 },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  langFlag: { fontSize: 22 },
  langName: { flex: 1 },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  cancelText: {},
});
