import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AdminCreditsFeedbackSheet } from '@/components/admin/credits/AdminCreditsFeedbackSheet';
import { AdminCreditsTabLists } from '@/components/admin/credits/AdminCreditsTabLists';
import {
  AdminOrderResolveSheet,
  type ResolveEscalationPayload,
} from '@/components/admin/orders/AdminOrderResolveSheet';
import { StatusPill } from '@/components/common/StatusPill';
import { ACTIVE_PHONE_COUNTRY_OPTIONS } from '@/constants/activeCountries';
import { useTheme } from '@/contexts/ThemeContext';
import { useAdminCreditsDashboard } from '@/hooks/useAdminCreditsDashboard';
import type { BusinessRootStackParamList } from '@/navigation/types';
import type {
  AdminCreditsTab,
  CreditEventType,
} from '@/types/adminCredits';

type Props = NativeStackScreenProps<BusinessRootStackParamList, 'AdminCredits'>;

const EVENT_LABELS: Record<CreditEventType, [string, string]> = {
  escalation_resolved: ['admin.credits.events.escalation', 'Escalation'],
  business_referred: [
    'admin.credits.events.businessReferred',
    'Business referred',
  ],
  agent_referred: ['admin.credits.events.agentReferred', 'Agent referred'],
  cancelled_feedback: [
    'admin.credits.events.cancelledFeedback',
    'Cancelled feedback',
  ],
  first_order_completed_feedback: [
    'admin.credits.events.firstOrderFeedback',
    'First-order feedback',
  ],
  my_first_purchase: ['admin.credits.events.firstPurchase', 'First purchase'],
};

const COUNTRY_LABELS: Record<string, [string, string]> = {
  CM: ['admin.credits.countries.CM', 'Cameroon'],
  GA: ['admin.credits.countries.GA', 'Gabon'],
  TG: ['admin.credits.countries.TG', 'Togo'],
  BJ: ['admin.credits.countries.BJ', 'Benin'],
  CI: ['admin.credits.countries.CI', "Côte d'Ivoire"],
  CG: ['admin.credits.countries.CG', 'Congo'],
  CA: ['admin.credits.countries.CA', 'Canada'],
  US: ['admin.credits.countries.US', 'United States'],
};

export default function AdminCreditsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  const dash = useAdminCreditsDashboard();
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [feedbackOrderId, setFeedbackOrderId] = useState<string | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<
    'cancelled' | 'first_order' | null
  >(null);

  const tabs = useMemo(
    () => [
      {
        key: 'escalations' as const,
        label: t('admin.credits.tabs.escalationsShort', 'Escalations'),
        count: dash.escalations.length,
      },
      {
        key: 'cancelled' as const,
        label: t('admin.credits.tabs.cancelledShort', 'Cancelled'),
        count: dash.cancelled.length,
      },
      {
        key: 'first_order' as const,
        label: t('admin.credits.tabs.firstOrderShort', 'First order'),
        count: dash.firstOrders.length,
      },
      {
        key: 'progress' as const,
        label: t('admin.credits.tabs.progressShort', 'Progress'),
        count: dash.summary.length,
      },
    ],
    [
      dash.cancelled.length,
      dash.escalations.length,
      dash.firstOrders.length,
      dash.summary.length,
      t,
    ]
  );

  if (dash.profileLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!dash.canAccess) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text
          variant="titleMedium"
          style={{ color: colors.text.primary, textAlign: 'center' }}
        >
          {t('admin.credits.accessDenied', 'Access denied')}
        </Text>
        <Text
          style={[
            typography.body2,
            {
              color: colors.text.secondary,
              textAlign: 'center',
              marginTop: spacing.xs,
            },
          ]}
        >
          {t(
            'admin.credits.accessDeniedHelp',
            'Ops follow-ups needs the platform.ops.credits permission on your account.'
          )}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {tabs.map((tab) => {
              const selected = dash.tab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => dash.setTab(tab.key as AdminCreditsTab)}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: spacing.md,
                    justifyContent: 'center',
                    borderRadius: borderRadius.lg,
                    backgroundColor: selected
                      ? colors.primary.main
                      : colors.surface,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary.main : colors.divider,
                  }}
                >
                  <Text
                    style={{
                      color: selected
                        ? colors.primary.contrast
                        : colors.text.primary,
                    }}
                  >
                    {tab.label} ({tab.count})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Pressable
              onPress={() => dash.setCountry('')}
              style={{
                minHeight: 40,
                paddingHorizontal: spacing.md,
                justifyContent: 'center',
                borderRadius: borderRadius.lg,
                backgroundColor:
                  dash.country === '' ? colors.primaryTint : colors.surface,
                borderWidth: 1,
                borderColor:
                  dash.country === '' ? colors.primary.main : colors.divider,
              }}
            >
              <Text style={{ color: colors.text.primary }}>
                {t('admin.credits.allCountries', 'All countries')}
              </Text>
            </Pressable>
            {ACTIVE_PHONE_COUNTRY_OPTIONS.map((opt) => {
              const selected = dash.country === opt.isoCode;
              return (
                <Pressable
                  key={opt.isoCode}
                  onPress={() => dash.setCountry(opt.isoCode)}
                  style={{
                    minHeight: 40,
                    paddingHorizontal: spacing.md,
                    justifyContent: 'center',
                    borderRadius: borderRadius.lg,
                    backgroundColor: selected
                      ? colors.primaryTint
                      : colors.surface,
                    borderWidth: 1,
                    borderColor: selected
                      ? colors.primary.main
                      : colors.divider,
                  }}
                >
                  <Text style={{ color: colors.text.primary }}>
                    {opt.flag}{' '}
                    {t(
                      COUNTRY_LABELS[opt.isoCode]?.[0] ??
                        `admin.credits.countries.${opt.isoCode}`,
                      COUNTRY_LABELS[opt.isoCode]?.[1] ?? opt.isoCode
                    )}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {dash.tab === 'progress' && Object.keys(dash.weights).length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {Object.entries(dash.weights).map(([key, weight]) => (
                <StatusPill
                  key={key}
                  compact
                  label={`${t(
                    EVENT_LABELS[key as CreditEventType]?.[0] ?? key,
                    EVENT_LABELS[key as CreditEventType]?.[1] ?? key
                  )}: ${weight}`}
                  backgroundColor={colors.primaryTint}
                  textColor={colors.primary.main}
                />
              ))}
            </View>
          </ScrollView>
        ) : null}

        {dash.error ? (
          <Text style={{ color: colors.error.main }}>{dash.error}</Text>
        ) : null}
      </View>

      {dash.loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <AdminCreditsTabLists
          tab={dash.tab}
          refreshing={dash.refreshing}
          submitting={dash.submitting}
          escalations={dash.escalations}
          cancelled={dash.cancelled}
          firstOrders={dash.firstOrders}
          summary={dash.summary}
          onRefresh={dash.refresh}
          onResolve={setResolveId}
          onOpenOrder={(orderId) =>
            navigation.navigate('AdminOrderDetail', { orderId })
          }
          onRecordFeedback={(orderId, mode) => {
            setFeedbackOrderId(orderId);
            setFeedbackMode(mode);
          }}
        />
      )}

      <AdminOrderResolveSheet
        visible={!!resolveId}
        submitting={dash.submitting}
        onDismiss={() => setResolveId(null)}
        onSubmit={async (payload: ResolveEscalationPayload) => {
          if (!resolveId) return;
          await dash.resolveEscalation(resolveId, payload);
          setResolveId(null);
        }}
      />

      <AdminCreditsFeedbackSheet
        visible={!!feedbackOrderId}
        title={
          feedbackMode === 'cancelled'
            ? t(
                'admin.credits.cancelledFeedbackTitle',
                'Cancelled-order feedback'
              )
            : t('admin.credits.firstOrderFeedbackTitle', 'First-order feedback')
        }
        mode={feedbackMode}
        order={
          feedbackOrderId
            ? (feedbackMode === 'cancelled'
                ? dash.cancelled
                : dash.firstOrders
              ).find((r) => r.id === feedbackOrderId) ?? null
            : null
        }
        submitting={dash.submitting}
        onDismiss={() => {
          if (dash.submitting) return;
          setFeedbackOrderId(null);
          setFeedbackMode(null);
        }}
        onSubmit={async (body) => {
          if (!feedbackOrderId || !feedbackMode) return;
          if (feedbackMode === 'cancelled') {
            await dash.saveCancelledFeedback(feedbackOrderId, body);
          } else {
            await dash.saveFirstOrderFeedback(feedbackOrderId, body);
          }
          setFeedbackOrderId(null);
          setFeedbackMode(null);
        }}
      />

      <Snackbar
        visible={!!dash.feedback}
        onDismiss={dash.clearFeedback}
        duration={dash.feedback?.type === 'error' ? 6000 : 3000}
        style={{
          backgroundColor:
            dash.feedback?.type === 'error'
              ? colors.error.main
              : colors.success.main,
        }}
        action={{
          label: t('common.dismiss', 'Dismiss'),
          onPress: dash.clearFeedback,
        }}
      >
        {dash.feedback?.message ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
