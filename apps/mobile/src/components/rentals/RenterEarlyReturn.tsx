import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { trackSiteEvent } from '../../services/analytics/AppEventsService';
import { reportReturned } from '../../services/rentalsApi';
import {
  bookedRange,
  returningNow,
  unusedDays,
  type EarlyReturnBooking,
} from '../../utils/rentals/earlyReturn';
import { EARLY_BLUE, EarlySheet, IconActionRow, SummaryTable, type SummaryLine } from './EarlyReturnParts';

export interface RenterEarlyReturnProps {
  booking: EarlyReturnBooking & { id: string };
  timeZone: string;
  /** Full booked price in the listing currency format ($60.00 / 60,00 $ / 45 000 FCFA). */
  price: string;
  /** Card deposit, formatted; empty for MoMo / XAF (no deposit). */
  deposit: string;
  location: string;
  address: string | null;
  onMessage: () => void;
  onReported: () => void;
  onAlreadyConfirmed: () => void;
  /** Open the sheet on mount (captures). */
  initialOpen?: boolean;
  now?: number;
}

/** AC1–3: ↶ Return early next to Directions / Message, and its confirm sheet (mock 01, 02, 02b, 03, 03b). */
export function RenterEarlyReturn(props: RenterEarlyReturnProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(Boolean(props.initialOpen));
  return (
    <View testID="renter-early-return">
      <IconActionRow
        actions={[
          {
            key: 'directions',
            icon: 'map-marker-outline',
            label: t('rentals.earlyReturn.directions', 'Directions'),
            onPress: () => openMaps(props.address || props.location),
          },
          {
            key: 'message',
            icon: 'message-outline',
            label: t('rentals.earlyReturn.message', 'Message'),
            onPress: props.onMessage,
          },
          {
            key: 'early',
            icon: 'undo-variant',
            label: t('rentals.earlyReturn.action', 'Return early'),
            onPress: () => setOpen(true),
            primary: true,
            testID: 'renter-early-return-action',
          },
        ]}
      />
      <RenterEarlyReturnSheet {...props} open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

export function RenterEarlyReturnSheet(props: RenterEarlyReturnProps & { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, typography } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = props.now ?? Date.now();
  const lang = i18n.language;
  const unused = unusedDays(props.booking, now, lang, props.timeZone);
  const lines: SummaryLine[] = [
    { key: 'booked', icon: 'calendar-blank-outline', label: t('rentals.earlyReturn.booked', 'Booked'), value: bookedRange(props.booking, lang, props.timeZone) },
  ];
  if (unused.length) {
    lines.push({ key: 'unused', icon: 'information-outline', label: t('rentals.earlyReturn.unusedDays', 'Unused days · no refund'), chips: unused });
  }
  lines.push(
    { key: 'now', icon: 'undo-variant', label: t('rentals.earlyReturn.returningNow', 'Returning now'), value: returningNow(props.booking, now, lang, props.timeZone) },
    {
      key: 'pay',
      icon: props.deposit ? 'credit-card-outline' : 'wallet-outline',
      label: t('rentals.earlyReturn.youPay', 'You pay'),
      value: props.price,
      sub: t('rentals.earlyReturn.fullPrice', 'full price'),
    }
  );
  if (props.deposit) {
    lines.push({
      key: 'deposit',
      icon: 'shield-outline',
      label: t('rentals.earlyReturn.deposit', 'Deposit'),
      value: props.deposit,
      sub: t('rentals.earlyReturn.depositAfter', 'released after the business confirms'),
    });
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await reportReturned(props.booking.id);
      if (!result.alreadyReported) {
        trackSiteEvent({
          eventType: 'rental_renter_reported_returned',
          subjectType: 'rental_booking',
          subjectId: props.booking.id,
          metadata: {
            booking_id: props.booking.id,
            reported_at: result.report.reportedAt,
            was_overdue: result.wasOverdue,
            early: true,
          },
        });
      }
      props.onClose();
      props.onReported();
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'RENTAL_RETURN_ALREADY_CONFIRMED') {
        props.onClose();
        props.onAlreadyConfirmed();
        return;
      }
      setError(
        code === 'RENTAL_RETURN_NOT_RECEIVED_OPEN'
          ? t('rentals.earlyReturn.notReceivedOpen', 'You reported that you didn’t receive the item. Support will follow up.')
          : t('rentals.earlyReturn.failed', 'Could not send. Check your connection and try again.')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <EarlySheet
      open={props.open}
      icon="undo-variant"
      testID="renter-early-return-sheet"
      title={t('rentals.earlyReturn.sheetTitle', 'Return early?')}
      body={
        props.deposit
          ? t('rentals.earlyReturn.sheetBody', 'You’ll still pay the full {{price}} for this booking. Your deposit is released once the business confirms the return.', { price: props.price })
          : t('rentals.earlyReturn.sheetBodyNoDeposit', 'You’ll still pay the full {{price}} for this booking. The business confirms the return when they get the item.', { price: props.price })
      }
      onClose={() => !busy && props.onClose()}
    >
      <SummaryTable lines={lines} testID="renter-early-return-summary" />
      <View style={{ flexDirection: 'row', marginTop: 12, alignItems: 'flex-start' }}>
        <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.text.secondary} style={{ marginTop: 2 }} />
        <Text style={[typography.caption, { color: colors.text.secondary, marginLeft: 6, flex: 1 }]}>
          {t('rentals.earlyReturn.where', 'Hand the item to the staff at {{location}}.', { location: props.address ? `${props.location} · ${props.address}` : props.location })}
        </Text>
      </View>
      {error ? <Text style={{ color: '#B42318', marginTop: 8 }}>{error}</Text> : null}
      <Button
        mode="contained"
        icon="undo-variant"
        buttonColor={EARLY_BLUE}
        loading={busy}
        disabled={busy}
        style={{ marginTop: 16, minHeight: 48, justifyContent: 'center' }}
        onPress={() => void submit()}
        testID="renter-early-return-confirm"
      >
        {t('rentals.earlyReturn.action', 'Return early')}
      </Button>
      <Button onPress={props.onClose} disabled={busy} textColor={colors.text.primary}>
        {t('rentals.earlyReturn.keep', 'Keep renting')}
      </Button>
    </EarlySheet>
  );
}

function openMaps(destination: string) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  void Linking.openURL(url);
}
