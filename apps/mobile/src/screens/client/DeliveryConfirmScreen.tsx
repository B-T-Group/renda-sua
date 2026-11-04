import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { CommonActions, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { agentApi } from '../../services/agentApi';
import { trackSiteEvent } from '../../services/analytics/AppEventsService';
import { deliveryConfirmSwitch } from '../../stores/deliveryConfirmSwitch';
import type { ClientRootStackParamList } from '../../navigation/types';
import {
  DELIVERY_FAILED_REASONS,
  ISSUE_REASONS,
  type DeliveryConfirmationState,
  type DeliveryReportType,
} from '../../types/deliveryConfirmation';
import {
  deliveryConfirmActions,
  formatHoursMinutes,
  minutesLeft,
  secondsSinceDelivered,
} from '../../utils/deliveryConfirmLink';

type Route = RouteProp<ClientRootStackParamList, 'DeliveryConfirm'>;

function formatTime(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(lang.startsWith('fr') ? 'fr-FR' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

/** Client Delivered → Complete screen (MoMo rail). The server state is the source of truth. */
export default function DeliveryConfirmScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation();
  const { orderId, source = 'in_app' } = useRoute<Route>().params;
  const { isOffline } = useNetworkStatus();

  const [state, setState] = useState<DeliveryConfirmationState | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [report, setReport] = useState<DeliveryReportType | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const opened = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await agentApi.orders.getDeliveryConfirmLink(orderId);
      if (res.accessible === false) {
        deliveryConfirmSwitch.showWrongAccount();
        navigation.goBack();
        return;
      }
      setState(res as DeliveryConfirmationState);
      setFetchedAt(Date.now());
      setError(null);
    } catch {
      setError(t('deliveryConfirm.error', 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [orderId, navigation, t]);

  useEffect(() => {
    const switched = deliveryConfirmSwitch.finish();
    if (!opened.current) {
      opened.current = true;
      void trackSiteEvent({
        eventType: 'delivery_confirm_opened',
        subjectType: 'order',
        subjectId: orderId,
        metadata: { source, persona_switched: switched },
      });
    }
    void load();
  }, [load, orderId, source]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const actions = deliveryConfirmActions(state, isOffline);
  const left = minutesLeft({
    deadlineAt: state?.autoCompleteDeadlineAt,
    serverNow: state?.serverNow,
    fetchedAtMs: fetchedAt,
    nowMs: now,
  });
  const hours = state?.autoCompleteHours ?? 2;
  const reportHours = state?.market?.reportWindowHours ?? 24;
  const variant = state?.confirmVariant ?? 'awaiting';

  const track = (action: string) =>
    void trackSiteEvent({
      eventType: 'delivery_confirm_action',
      subjectType: 'order',
      subjectId: orderId,
      metadata: { action, seconds_since_delivered: secondsSinceDelivered(state?.deliveredAt, Date.now()) },
    });

  const complete = async () => {
    setBusy(true);
    try {
      await agentApi.orders.confirmReceipt(orderId);
      track('complete');
      setDone(t('buyerProtection.success', 'Thanks! Your order is complete.'));
      await load();
    } catch {
      setError(t('deliveryConfirm.error', 'Something went wrong. Please try again.'));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async () => {
    if (!report || !reason) return;
    if (reason === 'other' && !note.trim()) {
      setError(t('deliveryConfirm.noteRequired', 'Please add a few details.'));
      return;
    }
    setBusy(true);
    try {
      await agentApi.orders.reportDeliveryProblem(orderId, { type: report, reason, note });
      track(report === 'issue' ? 'report_issue' : 'delivery_failed');
      setDone(t('deliveryConfirm.reported', 'Thanks. Our team is looking into it.'));
      setReport(null);
      setReason(null);
      setNote('');
      await load();
    } catch {
      setError(t('deliveryConfirm.error', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const backToOrder = () =>
    navigation.dispatch(CommonActions.navigate({ name: 'OrderDetail', params: { orderId } }));

  const countdown = useMemo(() => {
    if (left == null || variant !== 'awaiting') return null;
    if (left === 0) return t('deliveryConfirm.countdownSoon', 'Completing automatically…');
    const { h, m } = formatHoursMinutes(left);
    return h > 0
      ? t('deliveryConfirm.countdown', { h, m, defaultValue: 'Completes automatically in {{h}} h {{m}} min' })
      : t('deliveryConfirm.countdownMinutes', { m, defaultValue: 'Completes automatically in {{m}} min' });
  }, [left, variant, t]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const reasons = report === 'issue' ? ISSUE_REASONS : DELIVERY_FAILED_REASONS;
  const statusLine =
    variant === 'disputed'
      ? t('deliveryConfirm.state.disputed', 'Under review. Our team will contact you.')
      : variant === 'completed_can_report'
        ? t('deliveryConfirm.state.completedCanReport', {
            time: formatTime(state?.reportWindowEndsAt, i18n.language),
            defaultValue: 'Something wrong? You can report a problem until {{time}}.',
          })
        : variant === 'completed'
          ? t('deliveryConfirm.state.completed', {
              time: formatTime(state?.completedAt, i18n.language),
              defaultValue: 'Completed on {{time}}.',
            })
          : variant === 'closed'
            ? t('deliveryConfirm.state.closed', 'This order is closed. Contact support if you need help.')
            : variant === 'not_delivered_yet'
              ? t('deliveryConfirm.notDeliveredYet', 'Your courier is on the way.')
              : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.pageBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
      testID="delivery-confirm-screen"
    >
      <View style={[styles.hero, { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, borderColor: colors.divider }]}>
        <Text variant="labelLarge" style={{ color: colors.primary.main }}>
          {t('buyerProtection.badge', 'Delivery confirmed by you')}
        </Text>
        <Text variant="headlineSmall" style={{ color: colors.text.primary }}>
          {t('deliveryConfirm.title', 'Did you get your order?')}
        </Text>
        {state?.deliveredAt ? (
          <Text style={{ color: colors.text.secondary }}>
            {t('deliveryConfirm.deliveredAt', {
              time: formatTime(state.deliveredAt, i18n.language),
              defaultValue: 'Marked delivered at {{time}}',
            })}
          </Text>
        ) : null}
        {countdown ? (
          <Text variant="titleMedium" style={{ color: colors.text.primary }} testID="delivery-confirm-countdown">
            {countdown}
          </Text>
        ) : null}
        {statusLine ? <Text style={{ color: colors.text.secondary }}>{statusLine}</Text> : null}
        <Text style={{ color: colors.text.secondary }}>
          {t('buyerProtection.oneLiner', {
            hours,
            defaultValue:
              'Your order is complete only when you confirm it, or automatically {{hours}} h after delivery if you report no problem.',
          })}
        </Text>
        <Button mode="text" compact onPress={() => setSheet((v) => !v)} style={styles.left}>
          {t('deliveryConfirm.howItWorks', 'How it works')}
        </Button>
        {sheet ? (
          <View style={{ gap: spacing.xs }} testID="delivery-confirm-how">
            {(['step1', 'step2', 'step3', 'step4'] as const).map((k, i) => (
              <Text key={k} style={{ color: colors.text.secondary }}>
                {`${i + 1}. ${t(`buyerProtection.sheet.${k}`, { hours, reportHours })}`}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {done ? <Text style={{ color: colors.success.main }}>{done}</Text> : null}
      {error ? <Text style={{ color: colors.error.main }}>{error}</Text> : null}
      {isOffline ? (
        <Text style={{ color: colors.warning.main }} testID="delivery-confirm-offline">
          {t('deliveryConfirm.offline', "You're offline. Reconnect to confirm.")}
        </Text>
      ) : null}

      {report ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="titleMedium">
            {report === 'issue'
              ? t('deliveryConfirm.reportTitle', 'What went wrong?')
              : t('deliveryConfirm.failedTitle', 'What happened?')}
          </Text>
          <View style={styles.chips}>
            {reasons.map((r) => (
              <Chip key={r} selected={reason === r} onPress={() => setReason(r)}>
                {t(`deliveryConfirm.reason.${r}`)}
              </Chip>
            ))}
          </View>
          <TextInput
            mode="outlined"
            multiline
            value={note}
            onChangeText={setNote}
            placeholder={t('deliveryConfirm.notePlaceholder', 'Add details (optional)')}
          />
          <Text style={{ color: colors.text.secondary }}>
            {t('deliveryConfirm.reportNotice', 'Auto-complete is paused while our team reviews your report.')}
          </Text>
          <Button
            mode="contained"
            onPress={() => void submitReport()}
            loading={busy}
            disabled={busy || !reason || isOffline}
          >
            {t('deliveryConfirm.cta.submit', 'Send report')}
          </Button>
          <Button mode="text" onPress={() => setReport(null)} disabled={busy}>
            {t('deliveryConfirm.cta.cancel', 'Back')}
          </Button>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {variant === 'awaiting' || variant === 'not_delivered_yet' ? (
            <Button
              mode="contained"
              onPress={() => void complete()}
              loading={busy}
              disabled={busy || !actions.complete}
              testID="delivery-confirm-complete"
            >
              {t('deliveryConfirm.cta.complete', 'Complete')}
            </Button>
          ) : null}
          {actions.report || variant === 'awaiting' ? (
            <>
              <Button mode="outlined" onPress={() => setReport('issue')} disabled={busy || !actions.report}>
                {t('deliveryConfirm.cta.report', 'Report an issue')}
              </Button>
              <Button mode="text" onPress={() => setReport('delivery_failed')} disabled={busy || !actions.failed}>
                {t('deliveryConfirm.cta.failed', 'Delivery failed')}
              </Button>
            </>
          ) : null}
          <Button mode="text" onPress={backToOrder}>
<<<<<<< HEAD
            {t('deliveryConfirm.openOrder', 'View order')}
=======
            {t('orders.detailScreenTitle', 'Order detail')}
>>>>>>> origin/main
          </Button>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 1, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  left: { alignSelf: 'flex-start' },
});
