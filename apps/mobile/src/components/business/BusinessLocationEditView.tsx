import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Switch, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NoticeBanner } from '../common/NoticeBanner';
import { ConfirmActionDialog } from '../dialogs/ConfirmActionDialog';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { useBusinessLocationForm } from '../../hooks/business/useBusinessLocationForm';
import { buildLocationExpectations } from '../../utils/locationExpectations';
import { formatOperatingHoursSummary } from '../../utils/operatingHours';
import { spacing } from '../../theme/spacing';
import { LocationOptionArt } from './location-edit/LocationOptionArt';
import { SoftOption } from './location-edit/SoftOption';

type Form = ReturnType<typeof useBusinessLocationForm>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList, 'BusinessLocationForm'>;

export function BusinessLocationEditView({ form, navigation }: { form: Form; navigation: Nav }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const location = form.location;
  const [hideOpen, setHideOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<boolean | null>(null);
  useEffect(() => {
    if (location?.name) navigation.setOptions({ title: location.name });
  }, [location?.name, navigation]);
  if (!location) return null;

  const showMomo = !form.railLoading && !form.isStripeRail;
  const expectations = buildLocationExpectations(location, expectationCtx(form, location), (key, fallback) =>
    t(key, fallback)
  );
  const address = placeLine(location.address);

  return (
    <View style={[styles.page, { backgroundColor: colors.background.default }]}>
      <LocationHero name={location.name} address={address} />
      <SoftOption
        art="people"
        title={t('business.locations.expectations.title', 'What your customers will experience')}
        line={t('business.locations.editPage.expectLine', 'A quick look at what customers see.')}
        help={helpText(expectations.lines.map((line) => line.text), expectations.footnote)}
      />
      <HoursOption form={form} navigation={navigation} onHide={() => setHideOpen(true)} />
      {form.railLoading ? <NoticeBanner tone="info" message={t('common.loading', 'Loading...')} /> : null}
      {showMomo ? <PayoutOption form={form} /> : null}
      {showMomo ? <PayOption form={form} onToggle={setPayOpen} /> : null}
      <AlertsOption form={form} />
      <BasicsOption form={form} />
      <MoreOption form={form} />
      {form.saveError ? <NoticeBanner tone="warning" message={form.saveError} /> : null}
      <Button mode="text" onPress={() => navigation.navigate('BusinessInsights')}>
        {t('business.locations.allLocations.link', 'For all your locations')}
      </Button>
      <HideDialog open={hideOpen} onClose={() => setHideOpen(false)} onConfirm={() => void form.saveActive(false)} />
      <PayDialog
        next={payOpen}
        onClose={() => setPayOpen(null)}
        onConfirm={(next) => void form.savePayAtConfirm(next)}
      />
    </View>
  );
}

function LocationHero({ name, address }: { name: string; address: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: colors.primary.hover }]}>
      <LocationOptionArt kind="store" size={72} />
      <Text variant="headlineSmall" style={[styles.center, { color: colors.text.primary }]}>
        {name}
      </Text>
      {address ? (
        <Text variant="bodyMedium" style={[styles.center, { color: colors.text.secondary }]}>
          {address}
        </Text>
      ) : null}
    </View>
  );
}

function HoursOption({
  form,
  navigation,
  onHide,
}: {
  form: Form;
  navigation: Nav;
  onHide: () => void;
}) {
  const { t } = useTranslation();
  const location = form.location;
  if (!location) return null;
  const openHours = () => navigation.navigate('BusinessLocationHours', { locationId: location.id });
  return (
    <SoftOption
      art="hours"
      title={t('business.locations.openClosed.hoursTitle', 'Opening hours')}
      line={t('business.locations.editPage.hoursLine', 'Customers order during these hours.')}
      help={helpText([
        t('business.locations.openClosed.hoursHelp', "Customers can only choose pickup or delivery times when you're open. Orders for 'as soon as possible' stop a little before closing, so there's time to prepare."),
        t('business.locations.openClosed.cookedFoodNote', 'Cooked food uses the serving times set on each food item.'),
      ])}
    >
      <SwitchRow
        label={t('business.locations.openClosed.showLabel', 'Show this location to customers')}
        value={location.is_active}
        onChange={(next) => (next ? void form.saveActive(true) : onHide())}
      />
      <Text>{formatOperatingHoursSummary(location.operating_hours, t)}</Text>
      <Button mode="outlined" onPress={openHours}>
        {t('business.locations.hours.setNow', 'Set hours')}
      </Button>
    </SoftOption>
  );
}

function PayoutOption({ form }: { form: Form }) {
  const { t } = useTranslation();
  const location = form.location;
  if (!location) return null;
  const phone = location.mobile_payment_phone?.phone_e164;
  return (
    <SoftOption
      art="payout"
      title={t('business.locations.gettingPaid.title', 'Getting paid')}
      line={phone || t('business.locations.gettingPaid.noNumber', 'No number yet')}
      help={payoutHelp(t, !!phone)}
    >
      <SwitchRow
        label={t('business.locations.editPage.autoShort', 'Pay out automatically')}
        value={form.autoWithdraw}
        onChange={(next) => {
          form.setAutoWithdraw(next);
          void form.savePayments();
        }}
      />
    </SoftOption>
  );
}

function PayOption({ form, onToggle }: { form: Form; onToggle: (next: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <SoftOption
      art="pay"
      title={t('business.locations.payAfter.section', 'How customers pay')}
      line={t('business.locations.editPage.payLine', 'Customers can pay after you confirm.')}
      help={helpText([
        t('business.locations.payAfter.short', 'When on, customers order first. After you confirm, they have 45 minutes to pay with Mobile Money (3 hours for cooked food). Unpaid orders are cancelled and the stock goes back on sale.'),
        t('business.locations.payAfter.ownerOnly', 'Only the business owner can change this.'),
      ])}
    >
      <SwitchRow
        label={t('business.locations.payAfter.label', 'Ask customers to pay after you confirm')}
        value={form.payAtConfirm}
        onChange={onToggle}
      />
    </SoftOption>
  );
}

function AlertsOption({ form }: { form: Form }) {
  const { t } = useTranslation();
  return (
    <SoftOption
      art="bell"
      title={t('business.locations.editPage.alertsTitle', 'Order alerts')}
      line={t('business.locations.editPage.alertsLine', 'A second phone for new orders.')}
      help={t('business.locations.alerts.help', 'Add your kitchen or till phone. It gets a message for each new order at this location, and can confirm or update orders from there. You still get your own alerts.')}
    >
      <TextInput
        mode="outlined"
        value={form.orderAlertPhone}
        onChangeText={form.setOrderAlertPhone}
        placeholder="+237 …"
      />
      <Button mode="contained" onPress={() => void form.saveAlerts()}>
        {t('business.locations.alerts.save', 'Save alerts')}
      </Button>
    </SoftOption>
  );
}

function BasicsOption({ form }: { form: Form }) {
  const { t } = useTranslation();
  return (
    <SoftOption
      art="store"
      title={t('business.locations.basics.title', 'Name, logo & address')}
      line={t('business.locations.editPage.basicsLine', 'The name and logo customers see.')}
      help={t('business.locations.basics.logoHelp', 'Shown to customers next to this location.')}
    >
      <TextInput
        mode="outlined"
        label={t('business.locations.locationName', 'Location name')}
        value={form.name}
        onChangeText={form.setName}
      />
      <Button mode="outlined" onPress={() => void form.pickLogo()}>
        {t('business.locations.basics.uploadLogo', 'Upload a logo')}
      </Button>
      <Button mode="text" onPress={() => form.setAddressModalOpen(true)}>
        {t('business.locations.editAddress', 'Edit address')}
      </Button>
      <Button mode="contained" onPress={() => void form.saveBasics()}>
        {t('business.locations.basics.save', 'Save details')}
      </Button>
    </SoftOption>
  );
}

function MoreOption({ form }: { form: Form }) {
  const { t } = useTranslation();
  const location = form.location;
  if (!location) return null;
  return (
    <SoftOption
      art="store"
      title={t('business.locations.more.kind', 'Kind of place')}
      line={t(`business.locations.${location.location_type}`, location.location_type)}
      help={t(
        'business.locations.more.kindHelp',
        'Store, warehouse, office, or pickup point. This label is for you, so your locations are easy to tell apart.'
      )}
    >
      <MainLocationRow form={form} />
    </SoftOption>
  );
}

function MainLocationRow({ form }: { form: Form }) {
  const { t } = useTranslation();
  const location = form.location;
  if (!location) return null;
  if (location.is_primary) {
    return <Text>{t('business.locations.more.mainCurrent', "This is your main location. It can't be deleted.")}</Text>;
  }
  return (
    <Button mode="text" onPress={() => void form.makeMain()}>
      {t('business.locations.more.makeMain', 'Make this my main location')}
    </Button>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

function HideDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ConfirmActionDialog
      visible={open}
      title={t('business.locations.openClosed.hideTitle', 'Hide this location?')}
      message={t('business.locations.openClosed.showOff', "This location is hidden. Customers can't see its items or order from it until you turn it back on.")}
      cancelLabel={t('business.locations.openClosed.keepVisible', 'Keep it visible')}
      confirmLabel={t('business.locations.openClosed.hideConfirm', 'Hide it')}
      onDismiss={onClose}
      onConfirm={() => {
        onClose();
        onConfirm();
      }}
    />
  );
}

function PayDialog({
  next,
  onClose,
  onConfirm,
}: {
  next: boolean | null;
  onClose: () => void;
  onConfirm: (next: boolean) => void;
}) {
  const { t } = useTranslation();
  const turningOn = next === true;
  return (
    <ConfirmActionDialog
      visible={next != null}
      title={turningOn
        ? t('business.locations.payAfter.turnOnTitle', 'Turn on pay after you confirm?')
        : t('business.locations.payAfter.turnOffTitle', 'Turn off pay after you confirm?')}
      message={turningOn
        ? t('business.locations.payAfter.turnOnBody', 'When on, customers order first. After you confirm, they have 45 minutes to pay with Mobile Money (3 hours for cooked food). Unpaid orders are cancelled and the stock goes back on sale.')
        : t('business.locations.payAfter.turnOffBody', 'Customers will pay when they order, as set on each item.')}
      cancelLabel={t('common.cancel', 'Cancel')}
      confirmLabel={turningOn
        ? t('business.locations.payAfter.turnOn', 'Turn on')
        : t('business.locations.payAfter.turnOff', 'Turn off')}
      onDismiss={onClose}
      onConfirm={() => {
        onClose();
        onConfirm(turningOn);
      }}
    />
  );
}

function expectationCtx(
  form: Form,
  location: NonNullable<Form['location']>
) {
  return {
    isStripeRail: form.isStripeRail,
    hasVerifiedPhone: location.mobile_payment_phone?.is_verified === true,
  };
}

function placeLine(address: { address_line_1?: string; city?: string } | null | undefined) {
  return [address?.address_line_1, address?.city].filter(Boolean).join(', ');
}

function helpText(parts: Array<string | undefined>, extra?: string) {
  return [...parts, extra].filter(Boolean).join('\n\n');
}

function payoutHelp(t: (key: string, fallback: string) => string, hasPhone: boolean) {
  const status = hasPhone
    ? t('business.locations.gettingPaid.momoVerified', 'Verified. Your sales are paid out to this number.')
    : t('business.locations.gettingPaid.momoNone', 'No number yet. Add one so customers can buy from this location.');
  const auto = t(
    'business.locations.gettingPaid.autoOn',
    "Each time a sale's money reaches this location, we send it to your number."
  );
  return helpText([status, auto]);
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.lg },
  hero: { borderRadius: 24, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  switchLabel: { flex: 1 },
});
