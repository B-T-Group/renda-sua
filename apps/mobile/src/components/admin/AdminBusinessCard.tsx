import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Snackbar, Text } from 'react-native-paper';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { threadsApi } from '../../services/threadsApi';
import { AdminReferralMeta } from './AdminReferralMeta';
import { AdminApplyReferralSheet } from './AdminApplyReferralSheet';
import type { AdminBusinessListItem } from '../../types/adminBusinesses';
import { formatBusinessNextStep } from '../../utils/adminBusinessNextStep';
import { accurateLifecyclePill } from '../../utils/adminLifecycleUi';
import {
  reminderPretextsForIdStatus,
  type IdPretextDefinition,
} from '../../utils/adminIdPretexts';

export interface AdminBusinessCardProps {
  item: AdminBusinessListItem;
  showRail?: boolean;
  canSendMessages?: boolean;
  onVerify: (businessId: string) => void;
  onMessage?: (userId: string, name: string) => void;
  onApplyReferral?: (
    id: string,
    code: string,
    referrer?: { name: string; kind: 'agent' | 'business' }
  ) => Promise<void>;
}

function idPillColors(
  status: string,
  colors: {
    success: { main: string; dark?: string };
    warning: { main: string; dark?: string };
    error: { main: string; dark?: string };
    text: { secondary: string };
  }
): { backgroundColor: string; textColor: string } {
  if (status === 'approved') {
    return {
      backgroundColor: `${colors.success.main}22`,
      textColor: colors.success.dark ?? colors.success.main,
    };
  }
  if (status === 'pending') {
    return {
      backgroundColor: `${colors.warning.main}22`,
      textColor: colors.warning.dark ?? colors.warning.main,
    };
  }
  if (status === 'rejected') {
    return {
      backgroundColor: `${colors.error.main}22`,
      textColor: colors.error.dark ?? colors.error.main,
    };
  }
  return {
    backgroundColor: `${colors.text.secondary}18`,
    textColor: colors.text.secondary,
  };
}

export function AdminBusinessCard({
  item,
  showRail = true,
  canSendMessages = false,
  onVerify,
  onMessage,
  onApplyReferral,
}: AdminBusinessCardProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const [pretextBusy, setPretextBusy] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const pill = accurateLifecyclePill(item.lifecycle_status, colors, t);
  const summary = item.verificationSummary;
  const idStatus = summary?.idDocumentStatus;
  const nextStep = formatBusinessNextStep(item, t);
  const reminders = useMemo(
    () => reminderPretextsForIdStatus(idStatus),
    [idStatus]
  );

  const ownerName =
    `${item.user.first_name} ${item.user.last_name}`.trim() ||
    item.name ||
    '';

  const sendReminder = useCallback(
    async (pretext: IdPretextDefinition) => {
      if (!item.user_id || pretextBusy) return;
      setPretextBusy(true);
      try {
        const subject = pretext.subjectKey
          ? t(pretext.subjectKey, pretext.subjectDefault ?? '')
          : undefined;
        const body = t(pretext.bodyKey, pretext.bodyDefault);
        const result = await threadsApi.adminSendThread({
          recipientUserId: item.user_id,
          subject,
          body,
        });
        setSnack(
          result.success
            ? t('admin.users.messageSent', 'Message sent')
            : t('admin.businesses.actionFailed', 'Action failed')
        );
      } catch {
        setSnack(t('admin.businesses.actionFailed', 'Action failed'));
      } finally {
        setPretextBusy(false);
      }
    },
    [item.user_id, pretextBusy, t]
  );

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          ...shadows.sm,
        },
      ]}
    >
      <Text
        style={[typography.subtitle1, { color: colors.text.primary }]}
        numberOfLines={2}
      >
        {item.name || t('admin.businesses.unnamed', 'Business')}
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.secondary, marginTop: 4 },
        ]}
        numberOfLines={1}
      >
        {t('admin.businesses.ownerLabel', 'Owner')}: {item.user.first_name}{' '}
        {item.user.last_name}
        {item.user.email ? ` · ${item.user.email}` : ''}
      </Text>

      <AdminReferralMeta
        referralCode={item.referralCode}
        referredBy={item.referredBy}
        createdAt={item.created_at}
        onApply={
          item.referredBy || !onApplyReferral
            ? undefined
            : () => setApplyOpen(true)
        }
      />

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 8,
        }}
      >
        <StatusPill
          compact
          label={pill.label}
          backgroundColor={pill.backgroundColor}
          textColor={pill.textColor}
        />
        {showRail && summary?.rail ? (
          <StatusPill
            compact
            label={
              summary.rail === 'stripe'
                ? t('admin.businesses.railStripe', 'Stripe')
                : t('admin.businesses.railMobileMoney', 'Mobile money')
            }
            backgroundColor={`${colors.info.main}18`}
            textColor={colors.info.dark ?? colors.info.main}
          />
        ) : null}
        {idStatus ? (
          <StatusPill
            compact
            label={t(`admin.businesses.idStatus.${idStatus}`, idStatus)}
            {...idPillColors(idStatus, colors)}
          />
        ) : null}
      </View>

      {nextStep ? (
        <Text
          style={[
            typography.caption,
            { color: colors.text.secondary, marginTop: 6 },
          ]}
        >
          {nextStep}
        </Text>
      ) : null}

      <View style={[styles.actions, { marginTop: spacing.sm, gap: 8 }]}>
        <Button
          mode="outlined"
          compact
          style={{ alignSelf: 'flex-start' }}
          onPress={() => onVerify(item.id)}
        >
          {t('admin.businesses.verification', 'Verification')}
        </Button>
        {canSendMessages && item.user_id && onMessage ? (
          <Button
            mode="text"
            icon="message-text-outline"
            compact
            style={{ alignSelf: 'flex-start' }}
            onPress={() => onMessage(item.user_id!, ownerName)}
          >
            {t('admin.users.sendMessage', 'Message')}
          </Button>
        ) : null}
      </View>

      {canSendMessages && item.user_id && reminders.length > 0 ? (
        <View style={[styles.pretextRow, { marginTop: spacing.sm, gap: 8 }]}>
          <Text
            style={[typography.caption, { color: colors.text.secondary }]}
          >
            {t('admin.businesses.pretexts.quickReminders', 'Quick reminders')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {reminders.map((pretext) => (
              <Button
                key={pretext.key}
                mode="contained-tonal"
                compact
                disabled={pretextBusy}
                onPress={() => void sendReminder(pretext)}
              >
                {t(pretext.labelKey, pretext.labelDefault)}
              </Button>
            ))}
          </View>
        </View>
      ) : null}

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={2500}
      >
        {snack}
      </Snackbar>
      {onApplyReferral ? (
        <AdminApplyReferralSheet
          visible={applyOpen}
          onDismiss={() => setApplyOpen(false)}
          onSubmit={(code, referrer) => onApplyReferral(item.id, code, referrer)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  pretextRow: {},
});
