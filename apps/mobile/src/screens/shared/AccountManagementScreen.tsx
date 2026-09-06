import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Switch, Text, TextInput } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { SavedAccountCard } from '../../components/auth/SavedAccountCard';
import SessionService from '../../services/session/SessionService';
import SavedAccountService from '../../services/savedAccount/SavedAccountService';
import SecureStorageService from '../../services/storage/SecureStorageService';
import BiometricService from '../../services/biometric/BiometricService';
import type { AccountManagementScreenProps } from '../../navigation/types';

function AccountManagementScreenBase() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { auth, savedAccounts } = useStore();
  const navigation = useNavigation<AccountManagementScreenProps['navigation']>();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void savedAccounts.hydrate();
    }, [savedAccounts])
  );

  const confirmRemove = useCallback(
    (accountId: string, name: string) => {
      Alert.alert(
        t('savedAccounts.management.removeTitle', 'Remove account'),
        t(
          'savedAccounts.management.removeBody',
          'Remove {{name}} from this device? You will need to sign in again with a code.',
          { name }
        ),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('savedAccounts.management.removeConfirm', 'Remove'),
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setBusyId(accountId);
                if (auth.activeSavedAccountId === accountId && auth.isAuthenticated) {
                  await auth.logout('remove');
                } else {
                  const account = await SavedAccountService.findById(accountId);
                  if (account) {
                    await SecureStorageService.deleteRefreshToken(account.secureStoreKey);
                    await SavedAccountService.remove(accountId);
                    await savedAccounts.hydrate();
                  }
                }
                setBusyId(null);
              })();
            },
          },
        ]
      );
    },
    [auth, savedAccounts, t]
  );

  const toggleBiometrics = useCallback(
    async (accountId: string, enabled: boolean) => {
      setBusyId(accountId);
      if (enabled) {
        if (auth.activeSavedAccountId !== accountId) {
          setBusyId(null);
          return;
        }
        const bio = await BiometricService.authenticate(
          t('savedAccounts.management.enableBioPrompt', 'Confirm to enable biometrics')
        );
        if (!bio.ok) {
          setBusyId(null);
          return;
        }
        await SessionService.enableBiometricsForActiveAccount();
      } else {
        await SessionService.disableBiometricsForAccount(accountId);
      }
      setBusyId(null);
    },
    [auth.activeSavedAccountId, t]
  );

  const saveRename = useCallback(async () => {
    if (!renamingId) return;
    await SavedAccountService.setLabel(renamingId, renameDraft);
    await savedAccounts.hydrate();
    setRenamingId(null);
    setRenameDraft('');
  }, [renameDraft, renamingId, savedAccounts]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.pageBackground }]} edges={['top']}>
      <Appbar.Header style={{ backgroundColor: colors.surface }} statusBarHeight={0}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('savedAccounts.management.title', 'Saved accounts')} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
          {t(
            'savedAccounts.management.subtitle',
            'Accounts saved on this device for quick sign-in. Refresh tokens stay encrypted in secure storage.'
          )}
        </Text>

        {savedAccounts.sortedAccounts.map((account) => {
          const isActive = auth.activeSavedAccountId === account.id;
          const name = account.label?.trim() || account.displayName;
          return (
            <View key={account.id} style={{ marginBottom: spacing.lg }}>
              <SavedAccountCard
                account={account}
                disabled={busyId === account.id}
                onPress={() => {
                  if (isActive) return;
                  void SessionService.switchAccount(account.id);
                }}
              />

              {isActive ? (
                <Text variant="labelMedium" style={{ color: colors.primary.main, marginTop: 4 }}>
                  {t('savedAccounts.management.active', 'Active account')}
                </Text>
              ) : null}

              <View style={[styles.row, { marginTop: spacing.sm }]}>
                <Text variant="bodyMedium" style={{ color: colors.text.primary, flex: 1 }}>
                  {t('savedAccounts.management.biometrics', 'Biometrics')}
                </Text>
                <Switch
                  value={account.biometricEnabled}
                  onValueChange={(v) => void toggleBiometrics(account.id, v)}
                  disabled={
                    busyId === account.id ||
                    (!account.biometricEnabled && auth.activeSavedAccountId !== account.id)
                  }
                />
              </View>

              {account.lastLoginAt ? (
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
                  {t('savedAccounts.management.lastLogin', 'Last login: {{date}}', {
                    date: new Date(account.lastLoginAt).toLocaleString(),
                  })}
                </Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
                <Text
                  variant="labelLarge"
                  style={{ color: colors.primary.main }}
                  onPress={() => {
                    setRenamingId(account.id);
                    setRenameDraft(account.label ?? '');
                  }}
                >
                  {t('savedAccounts.management.rename', 'Rename')}
                </Text>
                <Text
                  variant="labelLarge"
                  style={{ color: colors.error.main }}
                  onPress={() => confirmRemove(account.id, name)}
                >
                  {t('savedAccounts.management.remove', 'Remove')}
                </Text>
              </View>
            </View>
          );
        })}

        {renamingId ? (
          <View style={{ marginTop: spacing.md }}>
            <TextInput
              label={t('savedAccounts.management.renameLabel', 'Account label')}
              value={renameDraft}
              onChangeText={setRenameDraft}
              mode="outlined"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.sm }}>
              <Text variant="labelLarge" onPress={() => setRenamingId(null)}>
                {t('common.cancel', 'Cancel')}
              </Text>
              <Text variant="labelLarge" style={{ color: colors.primary.main }} onPress={() => void saveRename()}>
                {t('common.save', 'Save')}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default observer(AccountManagementScreenBase);

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
