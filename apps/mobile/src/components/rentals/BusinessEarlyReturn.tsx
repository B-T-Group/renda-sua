import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import {
  fieldsToInstantIso,
  freedWindow,
  instantClock,
  listingFields,
  returnAtProblem,
  type EarlyReturnBooking,
} from '../../utils/rentals/earlyReturn';
import { EARLY_BLUE, EarlySheet, SummaryTable, type SummaryLine } from './EarlyReturnParts';

export interface BusinessReturnConfirmSheetProps {
  open: boolean;
  booking: EarlyReturnBooking;
  timeZone: string;
  /** Short zone label for the time field ("Montréal time"). */
  zoneLabel: string;
  price: string;
  /** Card deposit, formatted; empty when there is none (MoMo / XAF). */
  deposit: string;
  busy?: boolean;
  /** Start in edit mode (captures). */
  initialEditing?: boolean;
  now?: number;
  onClose: () => void;
  /** Real-instant ISO of the return, read on the listing clock. */
  onConfirm: (actualEndAt: string) => void;
}

/**
 * AC5/AC6 (mock 04b, 04c): business Confirm return. "Returned at" defaults to the
 * renter's report (or now for ↶ Item returned) and is edited on the listing clock,
 * never before pickup or after now.
 */
export function BusinessReturnConfirmSheet(props: BusinessReturnConfirmSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const lang = i18n.language;
  const reported = props.booking.renter_reported_returned_at || null;
  const [openedAt, setOpenedAt] = useState(() => props.now ?? Date.now());
  const defaultIso = reported || new Date(openedAt).toISOString();
  const [editing, setEditing] = useState(Boolean(props.initialEditing));
  const [date, setDate] = useState(listingFields(Date.parse(defaultIso), props.timeZone).date);
  const [time, setTime] = useState(listingFields(Date.parse(defaultIso), props.timeZone).time);

  useEffect(() => {
    if (!props.open) return;
    const at = props.now ?? Date.now();
    setOpenedAt(at);
    const iso = reported || new Date(at).toISOString();
    const fields = listingFields(Date.parse(iso), props.timeZone);
    setDate(fields.date);
    setTime(fields.time);
    setEditing(Boolean(props.initialEditing));
  }, [props.open, props.now, props.timeZone, props.initialEditing, reported]);

  const chosenIso = editing ? fieldsToInstantIso(date, time, props.timeZone) : defaultIso;
  const problem = returnAtProblem(chosenIso, props.booking, props.now ?? Date.now());
  const edited = editing && chosenIso !== defaultIso;
  const lines: SummaryLine[] = [
    {
      key: 'at',
      icon: 'undo-variant',
      label: t('rentals.earlyReturn.returnedAt', 'Returned at'),
      value: instantClock(chosenIso, lang, props.timeZone),
      sub: edited
        ? undefined
        : reported
          ? t('rentals.earlyReturn.rentersReport', 'renter’s report')
          : t('rentals.earlyReturn.now', 'now'),
      onEdit: () => setEditing(true),
      editLabel: t('rentals.earlyReturn.editTime', 'Change the return time'),
    },
    {
      key: 'pays',
      icon: props.deposit ? 'credit-card-outline' : 'wallet-outline',
      label: t('rentals.earlyReturn.renterPays', 'Renter pays'),
      value: props.price,
      sub: t('rentals.earlyReturn.fullPrice', 'full price'),
    },
  ];
  if (props.deposit) {
    lines.push({
      key: 'deposit',
      icon: 'shield-outline',
      label: t('rentals.earlyReturn.deposit', 'Deposit'),
      value: props.deposit,
      sub: t('rentals.earlyReturn.depositReleasedTo', 'released to the renter'),
    });
  }
  const window = chosenIso ? freedWindow(props.booking, chosenIso, lang, props.timeZone) : '';
  if (window) {
    lines.push({ key: 'opens', icon: 'lock-open-variant-outline', label: t('rentals.earlyReturn.opens', 'Opens for booking'), value: window });
  }
  const problemText =
    problem === 'beforePickup'
      ? t('rentals.earlyReturn.errBeforePickup', 'The return can’t be before pickup.')
      : problem === 'future'
        ? t('rentals.earlyReturn.errFuture', 'The return can’t be in the future.')
        : problem === 'invalid'
          ? t('rentals.earlyReturn.errInvalid', 'Enter a valid date and time.')
          : '';

  return (
    <EarlySheet
      open={props.open}
      icon="check"
      testID="business-return-confirm-sheet"
      title={t('rentals.earlyReturn.confirmTitle', 'Confirm return?')}
      body={t('rentals.earlyReturn.confirmBody', 'You checked the item and have it back. The rental ends now and you’re paid the full price.')}
      onClose={() => !props.busy && props.onClose()}
    >
      <SummaryTable lines={lines} testID="business-return-confirm-summary" />
      {editing ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }} testID="business-return-time-fields">
          <TextInput
            mode="outlined"
            label={t('rentals.earlyReturn.date', 'Date')}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            style={{ flex: 1 }}
            disabled={props.busy}
          />
          <TextInput
            mode="outlined"
            label={t('rentals.earlyReturn.time', 'Time ({{zone}})', { zone: props.zoneLabel })}
            value={time}
            onChangeText={setTime}
            placeholder="HH:mm"
            keyboardType="numbers-and-punctuation"
            style={{ flex: 1 }}
            disabled={props.busy}
          />
        </View>
      ) : null}
      {problemText ? <Text style={{ color: '#B42318', marginTop: 8 }}>{problemText}</Text> : null}
      <Button
        mode="contained"
        icon="check"
        buttonColor={EARLY_BLUE}
        loading={props.busy}
        disabled={props.busy || !!problem || !chosenIso}
        style={{ marginTop: 16, minHeight: 48, justifyContent: 'center' }}
        onPress={() => chosenIso && props.onConfirm(chosenIso)}
        testID="business-return-confirm"
      >
        {t('rentals.earlyReturn.confirm', 'Confirm return')}
      </Button>
      <Button onPress={props.onClose} disabled={props.busy} textColor={colors.text.primary}>
        {t('rentals.earlyReturn.cancel', 'Cancel')}
      </Button>
    </EarlySheet>
  );
}
