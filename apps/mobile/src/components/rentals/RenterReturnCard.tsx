import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { trackSiteEvent } from '../../services/analytics/AppEventsService';
import { reportReturned } from '../../services/rentalsApi';
import { formatDoualaStamp, type RenterReturnPhase } from '../../utils/rentals/renterReturnPhase';

export interface RenterReturnCardProps {
  phase: Exclude<RenterReturnPhase, 'hidden'>;
  bookingId: string;
  location: string;
  address: string | null;
  phone: string | null;
  endAt: string;
  reportedAt?: string | null;
  depositLabel: string;
  onReported: () => void;
  onAlreadyConfirmed: () => void;
  onMessage: () => void;
}

export function RenterReturnCard(props: RenterReturnCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const [sheet, setSheet] = useState<'confirm' | 'contact' | null>(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const overdue = props.phase === 'overdue';
  const tint = overdue ? colors.error.main : '#0A4FB5';
  const when = formatDoualaStamp(props.reportedAt || props.endAt, i18n.language);
  const due = formatDoualaStamp(props.endAt, i18n.language);

  const submit = async () => {
    setBusy(true);
    setRetry(false);
    try {
      const result = await reportReturned(props.bookingId);
      setSheet(null);
      if (!result.alreadyReported) {
        trackSiteEvent({
          eventType: 'rental_renter_reported_returned',
          subjectType: 'rental_booking',
          subjectId: props.bookingId,
          metadata: {
            booking_id: props.bookingId,
            reported_at: result.report.reportedAt,
            was_overdue: result.wasOverdue,
          },
        });
      }
      props.onReported();
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === 'RENTAL_RETURN_ALREADY_CONFIRMED') {
        setSheet(null);
        props.onAlreadyConfirmed();
        return;
      }
      setRetry(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      testID={`renter-return-${props.phase}`}
      style={[
        styles.card,
        {
          borderColor: tint + '55',
          backgroundColor: overdue ? '#FDECEC' : '#F3F7FB',
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginTop: spacing.md,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Text style={[styles.pill, { color: tint, borderColor: tint }]}>
          {t(overdue ? 'rentals.returnReport.overdue' : 'rentals.bookingStatus.awaiting_return', overdue ? 'Overdue' : 'Return due')}
        </Text>
        <Text style={[typography.caption, { color: colors.text.secondary, alignSelf: 'center' }]}>
          {t('rentals.returnReport.nextStep', 'Next step')}
        </Text>
      </View>
      <Text style={[typography.subtitle1, { color: overdue ? colors.error.main : colors.text.primary, fontWeight: '700' }]}>
        {titleFor(props.phase, t, props.location, due, when)}
      </Text>
      {bodyFor(props.phase, t, props.location, when, props.depositLabel) ? (
        <Text style={[typography.body2, { color: colors.text.primary, marginTop: spacing.xs }]}>
          {bodyFor(props.phase, t, props.location, when, props.depositLabel)}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Action icon="map-marker-outline" label={t('rentals.returnReport.directions', 'Directions')} onPress={() => openMaps(props.address || props.location)} />
        <Action icon="message-outline" label={t('rentals.returnReport.contact', 'Contact business')} onPress={() => setSheet('contact')} />
      </View>
      {props.phase === 'due' || props.phase === 'overdue' ? (
        <Button
          mode="contained"
          buttonColor="#0A4FB5"
          style={{ marginTop: spacing.md, minHeight: 48 }}
          onPress={() => { setRetry(false); setSheet('confirm'); }}
        >
          {t('rentals.returnReport.primary', 'I’ve returned it')}
        </Button>
      ) : null}
      <ConfirmSheet
        open={sheet === 'confirm'}
        busy={busy}
        retry={retry}
        depositLabel={props.depositLabel}
        onClose={() => setSheet(null)}
        onConfirm={() => void submit()}
      />
      <ContactSheet
        open={sheet === 'contact'}
        phone={props.phone}
        onClose={() => setSheet(null)}
        onMessage={() => { setSheet(null); props.onMessage(); }}
      />
    </View>
  );
}

function titleFor(
  phase: RenterReturnPhase,
  t: (key: string, def: string, opts?: Record<string, string>) => string,
  location: string,
  due: string,
  when: string
): string {
  if (phase === 'waiting') return t('rentals.returnReport.waitingTitle', 'Waiting for the business to confirm');
  if (phase === 'escalated') return t('rentals.returnReport.escalatedTitle', 'Support is checking your return');
  if (phase === 'overdue') return t('rentals.returnReport.overdueTitle', 'Overdue since {{time}}', { time: due });
  return t('rentals.returnReport.dueTitle', 'Bring the item to {{location}} by {{time}}', { location, time: due });
}

function bodyFor(
  phase: RenterReturnPhase,
  t: (key: string, def: string, opts?: Record<string, string>) => string,
  location: string,
  when: string,
  amount: string
): string {
  if (phase === 'waiting') {
    return t(
      'rentals.returnReport.waitingBody',
      'You reported the return on {{time}}. The business will check the item. Your {{amount}} deposit is released only after they confirm.',
      { time: when, amount }
    );
  }
  if (phase === 'escalated') {
    return t(
      'rentals.returnReport.escalatedBody',
      'You reported the return on {{time}}. The business has not confirmed within 24 hours. Support is following up. Your {{amount}} deposit is still held.',
      { time: when, amount }
    );
  }
  if (phase === 'overdue') {
    return t('rentals.returnReport.overdueBody', 'Bring the item to {{location}} as soon as you can.', { location });
  }
  return '';
}

function openMaps(destination: string) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  void Linking.openURL(url);
}

function Action({ icon, label, onPress }: { icon: 'map-marker-outline' | 'message-outline'; label: string; onPress: () => void }) {
  const { colors, borderRadius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.action, { borderColor: colors.divider, borderRadius: borderRadius.md, backgroundColor: colors.surface }]}
    >
      <MaterialCommunityIcons name={icon} size={22} color="#0A4FB5" />
      <Text style={{ marginTop: 4, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function ConfirmSheet(props: {
  open: boolean;
  busy: boolean;
  retry: boolean;
  depositLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={props.open} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} testID="renter-return-confirm-sheet">
        <Text style={styles.sheetTitle}>{t('rentals.returnReport.sheetTitle', 'Did you hand the item to the business?')}</Text>
        <Text style={{ marginTop: 8 }}>
          {t(
            'rentals.returnReport.sheetBody',
            'The business will check the item and confirm. Your {{amount}} deposit is released only after they confirm. This does not end the rental by itself.',
            { amount: props.depositLabel }
          )}
        </Text>
        {props.retry ? (
          <Text style={{ color: '#B42318', marginTop: 8 }}>
            {t('rentals.returnReport.networkBody', 'Check your connection and try again.')}
          </Text>
        ) : null}
        <Button mode="contained" buttonColor="#0A4FB5" loading={props.busy} disabled={props.busy} style={{ marginTop: 16, minHeight: 48 }} onPress={props.onConfirm}>
          {props.retry ? t('rentals.returnReport.retry', 'Try again') : t('common.confirm', 'Confirm')}
        </Button>
        <Button onPress={props.onClose} disabled={props.busy}>{t('common.cancel', 'Cancel')}</Button>
      </View>
    </Modal>
  );
}

function ContactSheet(props: { open: boolean; phone: string | null; onClose: () => void; onMessage: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={props.open} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.sheetTitle}>{t('rentals.returnReport.contact', 'Contact business')}</Text>
        {props.phone ? (
          <Button mode="contained" buttonColor="#0A4FB5" style={{ marginTop: 16, minHeight: 48 }} onPress={() => void Linking.openURL(`tel:${props.phone}`)}>
            {t('rentals.returnReport.call', 'Call')}
          </Button>
        ) : null}
        <Button mode="outlined" style={{ marginTop: 8, minHeight: 48 }} onPress={props.onMessage}>
          {t('rentals.returnReport.message', 'Message')}
        </Button>
        <Button onPress={props.onClose}>{t('common.cancel', 'Cancel')}</Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden', fontWeight: '600' },
  action: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', borderWidth: 1, padding: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
});
