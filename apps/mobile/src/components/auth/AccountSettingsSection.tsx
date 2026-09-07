import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { UserMenuRow } from '../common/UserMenuRow';
import { useStore } from '../../stores/RootStore';

export function AccountSettingsSection() {
  const { t } = useTranslation();
  const { savedAccounts } = useStore();
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();

  if (!savedAccounts.hasSavedAccounts) {
    return null;
  }

  return (
    <>
      <UserMenuRow
        icon="account-switch-outline"
        label={t('savedAccounts.switchAccount', 'Switch account')}
        subtitle={t('savedAccounts.switchAccountSubtitle', 'Choose another saved account')}
        onPress={() => navigation.navigate('SavedAccounts', { mode: 'switch' })}
      />
      <UserMenuRow
        icon="account-cog-outline"
        label={t('savedAccounts.manageAccounts', 'Manage saved accounts')}
        subtitle={t('savedAccounts.manageAccountsSubtitle', 'Rename, remove, or update biometrics')}
        onPress={() => navigation.navigate('AccountManagement')}
      />
    </>
  );
}
