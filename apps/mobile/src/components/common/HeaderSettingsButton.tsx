import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { IconButton } from 'react-native-paper';

/** Header gear. Stays in the bar so it does not cover return copy. */
export function HeaderSettingsButton() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  return (
    <IconButton
      icon="cog-outline"
      accessibilityLabel={t('nav.settings', 'Settings')}
      onPress={() => navigation.navigate('Profile' as never)}
    />
  );
}
