import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Switch, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SectionCard } from '../common/SectionCard';
import { NoticeBanner } from '../common/NoticeBanner';
import { ExpandableSection } from '../common/ExpandableSection';
import { ConfirmActionDialog } from '../dialogs/ConfirmActionDialog';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { useBusinessLocationForm } from '../../hooks/business/useBusinessLocationForm';
import { buildLocationExpectations } from '../../utils/locationExpectations';
import { formatOperatingHoursSummary } from '../../utils/operatingHours';
import { spacing } from '../../theme/spacing';

type Form = ReturnType<typeof useBusinessLocationForm>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList, 'BusinessLocationForm'>;

export function BusinessLocationEditView({ form, navigation }: { form: Form; navigation: Nav }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const location = form.location;
  const [hideOpen, setHideOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<boolean | null>(null);
  if (!location) return null;

  const expectations = buildLocationExpectations(
    location,
    {
      isStripeRail: form.isStripeRail,
      hasVerifiedPhone: location.mobile_payment_phone?.is_verified === true,
    },
    (key, fallback) => t(key, fallback)
  );
  const showMomo = !form.railLoading && !form.isStripeRail;

  return (
    <View style={[styles.page, { backgroundColor: colors.pageBackground }]}>
      <SectionCard title={t('business.locations.expectations.title', 'What your customers will experience')}>
        {expectations.lines.map((line) => (
          <Text key={line.id} style={{ color: line.tone === 'warning' ? colors.warning.main : colors.text.primary }}>
            {line.text}
          </Text>
        ))}
        {expectations.footnote ? (
          <Text style={{ color: colors.text.secondary }}>{expectations.footnote}</Text>
        ) : null}
      </SectionCard>
      <SectionCard title={t('business.locations.openClosed.hoursTitle', 'Opening hours')}>
        <Row
          label={t('business.locations.openClosed.showLabel', 'Show this location to customers')}
          help={t('business.locations.openClosed.showOn', "Customers can see this location's items and order from it.")}
          value={location.is_active}
          onChange={(next) => (next ? void form.saveActive(true) : setHideOpen(true))}
        />
        <Pressable onPress={() => navigation.navigate('BusinessLocationHours', { locationId: location.id })} style={styles.tap}>
          <Text>{formatOperatingHoursSummary(location.operating_hours, t)}</Text>
          <Text style={{ color: colors.text.secondary }}>
            {t('business.locations.openClosed.hoursHelp', "Customers can only choose pickup or delivery times when you're open. Orders for 'as soon as possible' stop a little before closing, so there's time to prepare.")}
          </Text>
        </Pressable>
      </SectionCard>
      {form.railLoading ? <NoticeBanner tone="info" message={t('common.loading', 'Loading...')} /> : null}
      {showMomo ? (
        <SectionCard title={t('business.locations.gettingPaid.title', 'Getting paid')}>
          <Text>{location.mobile_payment_phone?.phone_e164 || t('business.locations.gettingPaid.noNumber', 'No number yet')}</Text>
          <Text style={{ color: colors.text.secondary }}>
            {t('business.locations.gettingPaid.momoVerified', 'Verified. Your sales are paid out to this number.')}
          </Text>
          <Row
            label={t('business.locations.gettingPaid.autoLabel', 'Send my money to this number automatically')}
            help={t('business.locations.gettingPaid.autoOn', "Each time a sale's money reaches this location, we send it to your number.")}
            value={form.autoWithdraw}
            onChange={(next) => {
              form.setAutoWithdraw(next);
              void form.savePayments();
            }}
          />
        </SectionCard>
      ) : null}
      {showMomo ? (
        <SectionCard title={t('business.locations.payAfter.section', 'How customers pay')}>
          <Row
            label={t('business.locations.payAfter.label', 'Ask customers to pay after you confirm')}
            help={t('business.locations.payAfter.short', 'When on, customers order first. After you confirm, they have 45 minutes to pay with Mobile Money (3 hours for cooked food). Unpaid orders are cancelled and the stock goes back on sale.')}
            value={form.payAtConfirm}
            onChange={(next) => setPayOpen(next)}
          />
          <Text style={{ color: colors.text.secondary }}>
            {t('business.locations.payAfter.ownerOnly', 'Only the business owner can change this.')}
          </Text>
        </SectionCard>
      ) : null}
      <SectionCard title={t('business.locations.alerts.label', 'Extra phone for new-order alerts (optional)')}>
        <TextInput mode="outlined" value={form.orderAlertPhone} onChangeText={form.setOrderAlertPhone} placeholder="+237 …" />
        <Text style={{ color: colors.text.secondary }}>
          {t('business.locations.alerts.help', 'Add your kitchen or till phone. It gets a message for each new order at this location, and can confirm or update orders from there. You still get your own alerts.')}
        </Text>
        <Button mode="contained" onPress={() => void form.saveAlerts()}>{t('business.locations.alerts.save', 'Save alerts')}</Button>
      </SectionCard>
      <SectionCard title={t('business.locations.basics.title', 'Name, logo & address')}>
        <TextInput mode="outlined" label={t('business.locations.locationName', 'Location name')} value={form.name} onChangeText={form.setName} />
        <Button mode="outlined" onPress={() => void form.pickLogo()}>{t('business.locations.basics.uploadLogo', 'Upload a logo')}</Button>
        <Button mode="text" onPress={() => form.setAddressModalOpen(true)}>{t('business.locations.editAddress', 'Edit address')}</Button>
        <Button mode="contained" onPress={() => void form.saveBasics()}>{t('business.locations.basics.save', 'Save details')}</Button>
      </SectionCard>
      <ExpandableSection title={t('business.locations.more.title', 'More options')}>
        <Text>{t(`business.locations.${location.location_type}`, location.location_type)}</Text>
        <Text style={{ color: colors.text.secondary }}>{t('business.locations.more.kindHelp', 'Helps you tell your places apart.')}</Text>
        {!location.is_primary ? (
          <Button mode="text" onPress={() => void form.makeMain()}>
            {t('business.locations.more.makeMain', 'Make this my main location')}
          </Button>
        ) : (
          <Text>{t('business.locations.more.mainCurrent', "This is your main location. It can't be deleted.")}</Text>
        )}
      </ExpandableSection>
      {form.saveError ? <NoticeBanner tone="warning" message={form.saveError} /> : null}
      <Button mode="text" onPress={() => navigation.navigate('BusinessInsights')}>
        {t('business.locations.allLocations.link', 'For all your locations')}
      </Button>
      <ConfirmActionDialog
        visible={hideOpen}
        title={t('business.locations.openClosed.hideTitle', 'Hide this location?')}
        message={t('business.locations.openClosed.showOff', "This location is hidden. Customers can't see its items or order from it until you turn it back on.")}
        cancelLabel={t('business.locations.openClosed.keepVisible', 'Keep it visible')}
        confirmLabel={t('business.locations.openClosed.hideConfirm', 'Hide it')}
        onDismiss={() => setHideOpen(false)}
        onConfirm={() => {
          setHideOpen(false);
          void form.saveActive(false);
        }}
      />
      <ConfirmActionDialog
        visible={payOpen != null}
        title={payOpen
          ? t('business.locations.payAfter.turnOnTitle', 'Turn on pay after you confirm?')
          : t('business.locations.payAfter.turnOffTitle', 'Turn off pay after you confirm?')}
        message={payOpen
          ? t('business.locations.payAfter.turnOnBody', 'When on, customers order first. After you confirm, they have 45 minutes to pay with Mobile Money (3 hours for cooked food). Unpaid orders are cancelled and the stock goes back on sale.')
          : t('business.locations.payAfter.turnOffBody', 'Customers will pay when they order, as set on each item.')}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={payOpen
          ? t('business.locations.payAfter.turnOn', 'Turn on')
          : t('business.locations.payAfter.turnOff', 'Turn off')}
        onDismiss={() => setPayOpen(null)}
        onConfirm={() => {
          const next = payOpen === true;
          setPayOpen(null);
          void form.savePayAtConfirm(next);
        }}
      />
    </View>
  );
}

function Row({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text>{label}</Text>
        <Text>{help}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  rowText: { flex: 1 },
  tap: { minHeight: 44, justifyContent: 'center' },
});
