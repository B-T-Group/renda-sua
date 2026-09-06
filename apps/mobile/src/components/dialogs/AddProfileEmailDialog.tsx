import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Portal, Dialog, Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { agentApi } from '../../services/agentApi';
import { useTheme } from '../../contexts/ThemeContext';

function isValidEmail(email: string): boolean {
  const s = email.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

export interface AddProfileEmailDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
}

export function AddProfileEmailDialog({ visible, onDismiss, onSaved }: AddProfileEmailDialogProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fullScreen = width < 560;

  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setEmail('');
    setError(null);
  }, [visible]);

  const surfaceStyle = fullScreen
    ? {
        marginHorizontal: 0,
        marginVertical: 0,
        borderRadius: 0,
        width: '100%' as const,
        maxWidth: '100%' as const,
        maxHeight: height,
        alignSelf: 'stretch' as const,
      }
    : { maxWidth: Math.min(440, width - 32), alignSelf: 'center' as const };

  const edgePad = fullScreen
    ? { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }
    : {};

  const onSave = useCallback(async () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError(t('client.placeOrder.successScreen.emailInvalid', 'Please enter a valid email address.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await agentApi.users.updateMyEmail({ email: trimmed });
      if (!res.success) {
        const msg = res.error || res.message || '';
        if (msg.toLowerCase().includes('taken') || msg.includes('409')) {
          setError(t('client.placeOrder.successScreen.emailTaken', 'This email is already in use.'));
        } else {
          setError(msg || t('client.placeOrder.successScreen.emailError', 'Could not save your email.'));
        }
        return;
      }
      onSaved();
      onDismiss();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('409')) {
        setError(t('client.placeOrder.successScreen.emailTaken', 'This email is already in use.'));
      } else {
        setError(msg || t('client.placeOrder.successScreen.emailError', 'Could not save your email.'));
      }
    } finally {
      setSaving(false);
    }
  }, [email, onDismiss, onSaved, t]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={saving ? undefined : onDismiss} dismissable={!saving} style={surfaceStyle}>
        <View style={[styles.titleRow, fullScreen ? edgePad : { paddingHorizontal: 24 }]}>
          <MaterialCommunityIcons name="email-outline" size={28} color={colors.primary.main} />
          <Text variant="titleLarge" style={{ flex: 1, marginLeft: 12 }}>
            {t('client.placeOrder.successScreen.emailDialogTitle', 'Add your email')}
          </Text>
        </View>
        <Dialog.ScrollArea
          style={[
            fullScreen
              ? {
                  maxHeight: height - 180,
                  paddingLeft: 16 + insets.left,
                  paddingRight: 16 + insets.right,
                }
              : { maxHeight: height * 0.5 },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollBody}>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 12 }}>
              {t(
                'client.placeOrder.successScreen.emailDialogBody',
                'We will send order updates and receipts to this address.'
              )}
            </Text>
            <TextInput
              mode="outlined"
              label={t('client.placeOrder.successScreen.emailLabel', 'Email')}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              disabled={saving}
            />
            {error ? (
              <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: 10 }}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={fullScreen ? edgePad : undefined}>
          <Button onPress={onDismiss} disabled={saving}>
            {t('client.placeOrder.successScreen.emailCancel', 'Cancel')}
          </Button>
          <Button mode="contained" onPress={() => void onSave()} loading={saving} disabled={saving}>
            {t('client.placeOrder.successScreen.emailSave', 'Save')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  scrollBody: { paddingBottom: 16 },
});
