import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/layout/KeyboardAwareScrollView';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Avatar,
  Button,
  HelperText,
  Menu,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { SignupAddressModal } from '../../components/signup/SignupAddressModal';
import { MobilePaymentPhoneChooserSheet } from '../../components/dialogs/MobilePaymentPhoneChooserSheet';
import { MobilePaymentPhoneVerifyModal } from '../../components/dialogs/MobilePaymentPhoneVerifyModal';
import { useBusinessLocationForm } from '../../hooks/business/useBusinessLocationForm';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
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
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneModalMode, setPhoneModalMode] = useState<MobilePaymentPhoneModalMode>('add');
  const [phoneModalInitial, setPhoneModalInitial] = useState<MobilePaymentPhone | null>(null);
  const { isStripeRail } = useIsStripeRail();

  const selectedPhoneLabel = form.mobilePaymentPhoneId
    ? form.phones.find((p) => p.id === form.mobilePaymentPhoneId)?.phone_e164 ??
      t('business.locations.mobilePaymentPhone', 'Mobile money number')
    : t('mobilePaymentPhone.setCta', 'Set mobile money number');

  if (form.loading) {
    return <ActivityIndicator style={styles.loader} />;
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

        <Text variant="labelLarge" style={styles.sectionLabel}>
          {t('business.locations.logoLabel', 'Location logo')}
        </Text>
        <View style={styles.logoRow}>
          {form.logoUrl.trim() ? (
            <Image source={{ uri: form.logoUrl.trim() }} style={styles.logoPreview} />
          ) : (
            <Avatar.Icon size={72} icon="store" />
          )}
          <View style={styles.logoActions}>
            <TextInput
              label={t('business.locations.logoUrl', 'Logo image URL')}
              value={form.logoUrl}
              onChangeText={form.setLogoUrl}
              mode="outlined"
              dense
              placeholder={t('business.locations.logoUrlPlaceholder', 'https://')}
            />
            <View style={styles.logoButtons}>
              <Button
                mode="outlined"
                onPress={() => void form.pickLogo()}
                loading={form.uploadingLogo}
                disabled={form.saving}
                compact
              >
                {t('business.locations.logoUpload', 'Upload image')}
              </Button>
              {form.logoUrl ? (
                <Button mode="text" onPress={() => form.setLogoUrl('')} compact>
                  {t('business.locations.logoClear', 'Remove logo')}
                </Button>
              ) : null}
            </View>
            <HelperText type="info" visible>
              {t(
                'business.locations.logoUrlHint',
                'Paste a public image URL, or upload a file to store on S3.'
              )}
            </HelperText>
          </View>
        </View>

        <Menu
          visible={typeMenuOpen}
          onDismiss={() => setTypeMenuOpen(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setTypeMenuOpen(true)}
              style={styles.field}
              contentStyle={styles.menuAnchor}
            >
              {t('business.locations.locationType', 'Location type')}:{' '}
              {form.locationTypeOptions.find((o) => o.value === form.locationType)?.label}
            </Button>
          }
        >
          {form.locationTypeOptions.map((opt) => (
            <Menu.Item
              key={opt.value}
              onPress={() => {
                form.setLocationType(opt.value);
                setTypeMenuOpen(false);
              }}
              title={opt.label}
            />
          ))}
        </Menu>

        <View style={styles.switchRow}>
          <Text>{t('business.locations.isPrimary', 'Primary location')}</Text>
          <Switch value={form.isPrimary} onValueChange={form.setIsPrimary} />
        </View>

        {!isStripeRail ? (
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
        <TextInput
          label={t('business.locations.email', 'Email')}
          value={form.email}
          onChangeText={form.setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.field}
        />
        <TextInput
          label={t('business.locations.orderAlertPhone', 'Order alert phone')}
          value={form.orderAlertPhone}
          onChangeText={form.setOrderAlertPhone}
          mode="outlined"
          keyboardType="phone-pad"
          style={styles.field}
        />
        <HelperText type="info" visible>
          {t(
            'business.locations.orderAlertPhoneHint',
            'Kitchen WhatsApp / till phone for new-order alerts'
          )}
        </HelperText>

        <TextInput
          label={t('business.locations.commissionLabel', 'RendaSua commission')}
          value={t('business.locations.commissionAdminOnly', 'Commission is managed by Business Account Type.')}
          mode="outlined"
          editable={false}
          style={[styles.field, { opacity: 0.7 }]}
        />
        <HelperText type="info" visible>
          {t('business.locations.commissionManagedBy', 'Commission — Managed by your Business Account')}
        </HelperText>

        {!isStripeRail && (
          <View style={styles.switchRow}>
            <View style={styles.switchLabels}>
              <Text>{t('business.locations.autoWithdrawCommissions', 'Automatically send payouts to this phone')}</Text>
              <HelperText type="info" visible>
                {t(
                  'business.locations.autoWithdrawCommissionsHint',
                  'Requires a valid phone number above. You can turn this off anytime.'
                )}
              </HelperText>
            </View>
            <Switch value={form.autoWithdraw} onValueChange={form.setAutoWithdraw} />
          </View>
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
