import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Divider, Text } from 'react-native-paper';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { AuthSettingsMenu } from '../../components/auth/AuthSettingsMenu';
import { SavedAccountCard } from '../../components/auth/SavedAccountCard';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import Logo from '../../components/Logo';
import SessionService from '../../services/session/SessionService';
import type { SavedAccountsScreenProps } from '../../navigation/types';
import { getAuthFlowErrorKey } from '../../utils/authErrorI18nKey';

function SavedAccountsScreenBase() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = React.useContext(BottomTabBarHeightContext);
  const scrollBottomPad =
    (tabBarHeight ?? insets.bottom) + spacing.lg;
  const { auth, savedAccounts } = useStore();
  const navigation = useNavigation<SavedAccountsScreenProps['navigation']>();
  const route = useRoute<SavedAccountsScreenProps['route']>();
  const mode = route.params?.mode ?? 'continue';
  const [signingInId, setSigningInId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void savedAccounts.hydrate();
    }, [savedAccounts])
  );

  const title =
    mode === 'switch'
      ? t('savedAccounts.switchTitle', 'Switch account')
      : t('savedAccounts.continueTitle', 'Continue as');

  const handleSelect = useCallback(
    async (accountId: string) => {
      if (signingInId) return;
      setLocalError(null);
      setSigningInId(accountId);

      const ok =
        mode === 'switch'
          ? await SessionService.switchAccount(accountId)
          : await SessionService.signInWithSavedAccount(accountId);

      setSigningInId(null);

      if (!ok) {
        if (auth.error?.startsWith('savedAccounts.')) {
          setLocalError(t(auth.error, 'Unable to sign in. Try again or use another account.'));
        } else if (auth.error) {
          setLocalError(t(getAuthFlowErrorKey(auth.error)));
        } else {
          setLocalError(
            t('savedAccounts.errors.generic', 'Unable to sign in. Try again or use another account.')
          );
        }
      }
    },
    [auth.error, mode, signingInId, t]
  );

  const handleUseAnother = useCallback(() => {
    if (mode === 'switch') {
      navigation.goBack();
      return;
    }
    navigation.navigate('Login');
  }, [mode, navigation]);

  const signInRequiredMessage = t(
    'savedAccounts.errors.signInRequired',
    'This account needs a fresh sign-in. Sign in again with your code to continue.'
  );
  const needsFreshSignIn = auth.error === 'savedAccounts.errors.signInRequired';
  const displayError =
    localError ?? (needsFreshSignIn ? signInRequiredMessage : null);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: colors.pageBackground, paddingTop: insets.top }]}>
        <AuthSettingsMenu onAboutPress={() => navigation.navigate('About')} />
        <View style={[styles.content, { paddingHorizontal: spacing.lg }]}>
          <Logo />
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: spacing.lg }}>
            {t(
              'savedAccounts.webFallback',
              'Saved accounts with biometrics are available in the iOS and Android app. Sign in with your code below.'
            )}
          </Text>
          <Button
            mode="outlined"
            icon="login"
            onPress={handleUseAnother}
            style={{ marginTop: spacing.lg }}
          >
            {t('savedAccounts.signInWithCode', 'Sign in with a code')}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground, paddingTop: insets.top }]}>
      <AuthSettingsMenu onAboutPress={() => navigation.navigate('About')} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.lg, paddingBottom: scrollBottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {mode === 'switch' && navigation.canGoBack() ? (
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            style={[styles.backBtn, { marginBottom: spacing.sm }]}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
          </Pressable>
        ) : null}
        <View style={styles.header}>
          <Logo />
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
            {title}
          </Text>
        </View>

        {displayError ? (
          <NoticeBanner variant="error" message={displayError} style={{ marginBottom: spacing.md }} />
        ) : null}

        {needsFreshSignIn && mode === 'continue' ? (
          <Button
            mode="contained"
            icon="login"
            onPress={handleUseAnother}
            disabled={!!signingInId}
            style={{ marginBottom: spacing.md }}
          >
            {t('savedAccounts.signInAgain', 'Sign in again')}
          </Button>
        ) : null}

        {savedAccounts.isLoading ? (
          <ActivityIndicator size="large" color={colors.primary.main} style={{ marginTop: spacing.xl }} />
        ) : (
          savedAccounts.sortedAccounts.map((account) => (
            <SavedAccountCard
              key={account.id}
              account={account}
              disabled={!!signingInId}
              onPress={() => void handleSelect(account.id)}
            />
          ))
        )}

        {signingInId ? (
          <View style={styles.signingRow}>
            <ActivityIndicator size="small" color={colors.primary.main} />
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginLeft: 8 }}>
              {t('savedAccounts.signingIn', 'Signing in?')}
            </Text>
          </View>
        ) : null}

        <Divider style={{ marginTop: spacing.lg, marginBottom: spacing.sm }} />

        <Text
          variant="labelMedium"
          style={{ color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.sm }}
        >
          {t('savedAccounts.orLabel', 'or')}
        </Text>

        <Button
          mode="outlined"
          icon="login"
          onPress={handleUseAnother}
          disabled={!!signingInId}
          style={{ marginBottom: spacing.sm }}
        >
          {mode === 'switch'
            ? t('savedAccounts.cancelSwitch', 'Cancel')
            : t('savedAccounts.signInWithCode', 'Sign in with a code')}
        </Button>
      </ScrollView>
    </View>
  );
}

export default observer(SavedAccountsScreenBase);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 24 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { marginTop: 16, fontWeight: '700', textAlign: 'center' },
  backBtn: { alignSelf: 'flex-start', padding: 4 },
  signingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
});
