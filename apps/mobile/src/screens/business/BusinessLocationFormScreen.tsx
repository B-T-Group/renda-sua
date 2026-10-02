import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/layout/KeyboardAwareScrollView';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  HelperText,
  TextInput,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { SignupAddressModal } from '../../components/signup/SignupAddressModal';
import { MobilePaymentPhoneChooserSheet } from '../../components/dialogs/MobilePaymentPhoneChooserSheet';
import { MobilePaymentPhoneVerifyModal } from '../../components/dialogs/MobilePaymentPhoneVerifyModal';
import { BusinessLocationEditView } from '../../components/business/BusinessLocationEditView';
import { useBusinessLocationForm } from '../../hooks/business/useBusinessLocationForm';
import type {
  MobilePaymentPhone,
  MobilePaymentPhoneModalMode,
} from '../../types/mobilePaymentPhone';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<BusinessRootStackParamList, 'BusinessLocationForm'>;

export default function BusinessLocationFormScreen({ route, navigation }: Props) {
  const { locationId } = route.params ?? {};
  const { t } = useTranslation();
  const { colors } = useTheme();
  const form = useBusinessLocationForm(locationId, navigation);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneModalMode, setPhoneModalMode] = useState<MobilePaymentPhoneModalMode>('add');
  const [phoneModalInitial, setPhoneModalInitial] = useState<MobilePaymentPhone | null>(null);
  const selectedPhoneLabel = form.mobilePaymentPhoneId
    ? form.phones.find((p) => p.id === form.mobilePaymentPhoneId)?.phone_e164 ??
      t('business.locations.mobilePaymentPhone', 'Mobile money number')
    : t('mobilePaymentPhone.setCta', 'Set mobile money number');

  if (form.loading) {
    return <ActivityIndicator style={styles.loader} />;
  }

  if (form.isEditing) {
    return (
      <KeyboardAwareScrollView
        avoidingViewStyle={{ flex: 1, backgroundColor: colors.pageBackground }}
        contentContainerStyle={styles.form}
      >
        <BusinessLocationEditView form={form} navigation={navigation} />
        <SignupAddressModal
          visible={form.addressModalOpen}
          value={form.addressForm}
          onChange={form.setAddressForm}
          onDismiss={() => form.setAddressModalOpen(false)}
          onSave={() => {
            void form.saveAddress();
            form.setAddressModalOpen(false);
          }}
        />
      </KeyboardAwareScrollView>
    );
  }

  return (
    <>
      <KeyboardAwareScrollView
        avoidingViewStyle={{ flex: 1, backgroundColor: colors.pageBackground }}
        contentContainerStyle={styles.form}
      >
        {form.saveError ? (
          <HelperText type="error" visible>
            {form.saveError}
          </HelperText>
        ) : null}

        <TextInput
          label={t('business.locations.locationName', 'Location name')}
          value={form.name}
          onChangeText={form.setName}
          mode="outlined"
        />
        <HelperText type="info" visible>
          {form.nameHint}
        </HelperText>


        {form.railLoading ? null : !form.isStripeRail ? (
          <Button
            mode="outlined"
            onPress={() => {
              void form.fetchPhones();
              setChooserOpen(true);
            }}
            style={styles.field}
          >
            {selectedPhoneLabel}
          </Button>
        ) : (
          <TextInput
            label={t('business.locations.phone', 'Phone')}
            value={form.phone}
            onChangeText={form.setPhone}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.field}
          />
        )}

        <Button mode="outlined" onPress={() => form.setAddressModalOpen(true)} style={styles.field}>
          {form.addressForm.address_line_1
            ? `${form.addressForm.address_line_1}, ${form.addressForm.city}`
            : t('business.locations.addLocationAddress', 'Add location address')}
        </Button>
        {form.primaryCountry && !form.isEditing ? (
          <HelperText type="info" visible>
            {t(
              'business.locations.countryReadOnly',
              'Country is set from your business address and cannot be changed.'
            )}{' '}
            ({form.primaryCountry})
          </HelperText>
        ) : null}

        <Button
          mode="contained"
          loading={form.saving}
          onPress={() => void form.save()}
          style={styles.field}
        >
          {t('common.save', 'Save')}
        </Button>
      </KeyboardAwareScrollView>

      <SignupAddressModal
        visible={form.addressModalOpen}
        value={form.addressForm}
        onChange={form.setAddressForm}
        onDismiss={() => form.setAddressModalOpen(false)}
        onSave={() => form.setAddressModalOpen(false)}
      />

      <MobilePaymentPhoneChooserSheet
        visible={chooserOpen}
        phones={form.phones}
        verificationMethod={form.verificationMethod}
        selectedPhoneId={form.mobilePaymentPhoneId}
        allowNone
        onDismiss={() => setChooserOpen(false)}
        onSelect={(phone) => {
          form.setMobilePaymentPhoneId(phone.id);
          form.setPhone(phone.phone_e164);
          setChooserOpen(false);
        }}
        onSelectNone={() => {
          form.setMobilePaymentPhoneId(null);
          form.setPhone('');
          setChooserOpen(false);
        }}
        onAddNew={() => {
          setChooserOpen(false);
          setPhoneModalMode('add');
          setPhoneModalInitial(null);
          setPhoneModalOpen(true);
        }}
        onVerify={(phone) => {
          setChooserOpen(false);
          setPhoneModalMode('verify');
          setPhoneModalInitial(phone);
          setPhoneModalOpen(true);
        }}
      />

      <MobilePaymentPhoneVerifyModal
        visible={phoneModalOpen}
        mode={phoneModalMode}
        initialPhone={phoneModalInitial}
        onDismiss={() => {
          setPhoneModalOpen(false);
          setPhoneModalInitial(null);
        }}
        onCompleted={(phone) => {
          void form.fetchPhones();
          form.setMobilePaymentPhoneId(phone.id);
          form.setPhone(phone.phone_e164);
          setPhoneModalOpen(false);
          setPhoneModalInitial(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  form: { padding: spacing.md, paddingBottom: 40, gap: spacing.xs },
  field: { marginTop: spacing.sm },
  sectionLabel: { marginTop: spacing.md },
  logoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  logoPreview: { width: 72, height: 72, borderRadius: 8 },
  logoActions: { flex: 1, gap: spacing.xs },
  logoButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  switchLabels: { flex: 1 },
  menuAnchor: { justifyContent: 'flex-start' },
});
