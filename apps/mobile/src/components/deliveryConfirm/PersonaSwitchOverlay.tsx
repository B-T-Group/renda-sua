import { useSyncExternalStore } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Snackbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { CommonActions } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { deliveryConfirmSwitch } from '../../stores/deliveryConfirmSwitch';
import { rootNavigationRef } from '../../navigation/rootNavigationRef';
import { useStore } from '../../stores/RootStore';
import { personaLabelDefault, personaLabelKey } from '../enroll/personaEnrollUi';

/**
 * Delivery-confirm deep link chrome (P2–P4): switch overlay (≤1 s), the
 * one-time "Back to {persona}" toast, and the safe wrong-account screen,
 * which never shows order data.
 */
export function PersonaSwitchOverlay() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { persona } = useStore();
  const s = useSyncExternalStore(deliveryConfirmSwitch.subscribe, deliveryConfirmSwitch.get);

  const back = () => {
    const from = s.toastPersona;
    deliveryConfirmSwitch.dismissToast();
    if (from) void persona.selectPersona(from);
  };

  const openAccounts = () => {
    deliveryConfirmSwitch.closeWrongAccount();
    if (rootNavigationRef.isReady()) {
      rootNavigationRef.dispatch(CommonActions.navigate({ name: 'SavedAccounts' }));
    }
  };

  return (
    <>
      <Modal visible={s.switching} transparent animationType="fade">
        <View style={[styles.fill, { backgroundColor: colors.pageBackground }]} testID="persona-switch-overlay">
          <ActivityIndicator />
          <Text style={{ marginTop: spacing.md, color: colors.text.primary }}>
            {t('personaSwitch.client', 'Switching to your shopper account…')}
          </Text>
        </View>
      </Modal>

      <Modal visible={s.wrongAccount} animationType="slide" onRequestClose={deliveryConfirmSwitch.closeWrongAccount}>
        <View style={[styles.fill, { backgroundColor: colors.pageBackground, padding: spacing.lg }]} testID="delivery-confirm-unavailable">
          <Text variant="titleLarge" style={[styles.center, { color: colors.text.primary }]}>
            {t('deliveryConfirm.unavailable.title', 'This order belongs to another account')}
          </Text>
          <Text style={[styles.center, { marginTop: spacing.sm, color: colors.text.secondary }]}>
            {t('deliveryConfirm.unavailable.body', 'Sign in with the account that placed this order to confirm it.')}
          </Text>
          <Button mode="contained" style={{ marginTop: spacing.lg }} onPress={openAccounts}>
            {t('deliveryConfirm.unavailable.switch', 'Switch account')}
          </Button>
          <Button mode="text" onPress={deliveryConfirmSwitch.closeWrongAccount}>
            {t('deliveryConfirm.unavailable.close', 'Close')}
          </Button>
        </View>
      </Modal>

      <Snackbar
        visible={!!s.toastPersona}
        onDismiss={deliveryConfirmSwitch.dismissToast}
        duration={5000}
        action={{
          label: t('personaSwitch.backTo', {
            persona: s.toastPersona
              ? t(personaLabelKey(s.toastPersona), personaLabelDefault(s.toastPersona))
              : '',
            defaultValue: 'Back to {{persona}}',
          }),
          onPress: back,
        }}
      >
        {t('personaSwitch.nowClient', "You're now in your shopper account.")}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
