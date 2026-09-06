import { ScrollView, StyleSheet, View } from 'react-native';
import { AppModal } from '../common/AppModal';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { DeliveryAddressFormValue } from '../forms/DeliveryAddressForm';
import {
  isSignupAddressComplete,
  SignupAddressFormSection,
} from './SignupAddressFormSection';

export interface SignupAddressModalProps {
  visible: boolean;
  value: DeliveryAddressFormValue;
  onChange: (next: DeliveryAddressFormValue) => void;
  onDismiss: () => void;
  onSave: () => void;
  saving?: boolean;
}

export function SignupAddressModal({
  visible,
  value,
  onChange,
  onDismiss,
  onSave,
  saving = false,
}: SignupAddressModalProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const complete = isSignupAddressComplete(value);

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !saving && onDismiss()}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View
          style={[
            styles.box,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              borderColor: colors.divider,
            },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <SignupAddressFormSection value={value} onChange={onChange} disabled={saving} />
            <View style={[styles.actions, { marginTop: spacing.lg }]}>
              <Button mode="outlined" onPress={onDismiss} disabled={saving} style={styles.btn}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button mode="contained" onPress={onSave} loading={saving} disabled={saving || !complete} style={styles.btn}>
                {t('auth.signupFlow.addressSave', 'Save address')}
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    maxHeight: '88%',
    padding: 20,
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
  },
});
