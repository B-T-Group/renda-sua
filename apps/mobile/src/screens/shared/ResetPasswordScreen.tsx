import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { AppButton, GhostButton } from '../../components/common/AppButton';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import Auth0DirectService from '../../services/auth0DirectService';
import type { ResetPasswordScreenProps } from '../../navigation/types';
import {
  keyboardAwareScrollProps,
  useKeyboardVerticalOffset,
} from '../../hooks/useKeyboardVerticalOffset';

export default function ResetPasswordScreen({ navigation }: ResetPasswordScreenProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollBottomPad = tabBarHeight + spacing.lg;
  const keyboardVerticalOffset = useKeyboardVerticalOffset(12);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage(t('auth.errors.requiredEmail', 'Please enter your email address.'));
      return;
    }
    setSending(true);
    setErrorMessage(null);
    const { ok, message } = await Auth0DirectService.sendPasswordResetEmail(trimmed);
    setSending(false);
    if (ok) {
      setSent(true);
    } else {
      setErrorMessage(message || t('auth.errors.generic', 'Something went wrong. Please try again.'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        {...keyboardAwareScrollProps}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollBottomPad, paddingTop: Math.max(24, insets.top + 8) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.form}>
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
            {t('auth.resetPassword.title', 'Reset password')}
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.text.secondary }]}>
            {t('auth.resetPassword.subtitle', "Enter your email and we'll send you a reset link.")}
          </Text>

          {sent ? (
            <NoticeBanner
              tone="success"
              title={t('auth.resetPassword.sentTitle', 'Check your inbox')}
              message={t(
                'auth.resetPassword.sentMessage',
                'A reset link has been sent to {{email}}. It may take a minute to arrive.',
                { email: email.trim() }
              )}
              style={styles.banner}
            />
          ) : (
            <>
              {errorMessage ? (
                <NoticeBanner
                  tone="error"
                  message={errorMessage}
                  style={styles.banner}
                />
              ) : null}

              <TextInput
                mode="outlined"
                label={t('auth.email', 'Email')}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!sending}
                style={styles.input}
                error={!!errorMessage}
              />

              <AppButton
                label={t('auth.resetPassword.button', 'Send reset link')}
                onPress={() => void handleSend()}
                loading={sending}
                fullWidth
                style={styles.button}
              />
            </>
          )}

          <GhostButton
            label={t('common.back', 'Back')}
            onPress={() => navigation.goBack()}
            disabled={sending}
            fullWidth
            style={styles.backButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: { marginBottom: 8, textAlign: 'center', fontWeight: '800' },
  subtitle: { textAlign: 'center', marginBottom: 24, paddingHorizontal: 8 },
  banner: { marginBottom: 16 },
  input: { marginBottom: 16 },
  button: { marginBottom: 8 },
  backButton: { marginTop: 8 },
});
