import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Divider, Snackbar, Text } from 'react-native-paper';
import { AdminOrderContactSheet } from '../../components/admin/orders/AdminOrderContactSheet';
import { AdminOrderResolveSheet } from '../../components/admin/orders/AdminOrderResolveSheet';
import { AdminOrderRiskPill } from '../../components/admin/orders/AdminOrderRiskPill';
import { StatusPill } from '../../components/common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { useAdminOrderDetail } from '../../hooks/useAdminOrderDetail';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type {
  AdminOrderContact,
  OrderContactRole,
} from '../../types/adminOrders';
import {
  contactRoleLabel,
  formatOverdue,
  nextActionLabel,
  riskTypeLabel,
  statusText,
} from '../../utils/adminOrderRisk';

type Props = NativeStackScreenProps<
  BusinessRootStackParamList,
  'AdminOrderDetail'
>;

export default function AdminOrderDetailScreen({ route }: Props) {
  const { orderId } = route.params;
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  const detail = useAdminOrderDetail(orderId);
  const [activeContact, setActiveContact] = useState<AdminOrderContact | null>(
    null
  );
  const [resolveIncidentId, setResolveIncidentId] = useState<string | null>(
    null
  );

  const handleSend = async (
    role: OrderContactRole,
    channel: 'message' | 'sms',
    message: string
  ) => {
    if (channel === 'sms') await detail.sendSms(role, message);
    else await detail.sendMessage(role, message);
  };

  /** The hook already surfaces the failure in the snackbar; swallow the rejection. */
  const runFromButton = (action: () => Promise<unknown>) => {
    action().catch(() => undefined);
  };

  if (detail.profileLoading || (detail.loading && !detail.order)) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!detail.canAccess) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text variant="titleMedium" style={{ color: colors.text.primary }}>
          {t('admin.orders.accessDenied', 'Access denied')}
        </Text>
      </View>
    );
  }

  const order = detail.order;
  if (!order) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
          {detail.error ||
            t('admin.orders.detailError', 'Could not load this order.')}
        </Text>
        <Button onPress={detail.refresh} style={{ marginTop: spacing.sm }}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  const recommendation = nextActionLabel(t, order.next_action);
  const hasAgent = order.current_status === 'assigned_to_agent';
  const redispatchTitle = hasAgent
    ? t('admin.orders.unassignRedispatch', 'Unassign & redispatch')
    : t('admin.orders.redispatch', 'Redispatch to agents');
  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          gap: spacing.md,
          paddingBottom: spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={detail.refreshing}
            onRefresh={detail.refresh}
          />
        }
      >
        <View style={cardStyle}>
          <Text variant="titleLarge" style={{ color: colors.text.primary }}>
            {order.order_number}
          </Text>
          <View style={[styles.row, { gap: spacing.xs }]}>
            <AdminOrderRiskPill level={order.risk_level} compact />
            <StatusPill
              label={statusText(order.current_status)}
              backgroundColor={colors.infoTint}
              textColor={colors.info.main}
              compact
            />
          </View>
          {recommendation ? (
            <Text style={[typography.body2, { color: colors.primary.main }]}>
              {recommendation}
            </Text>
          ) : null}
        </View>

        <View style={cardStyle}>
          <Text variant="titleMedium" style={{ color: colors.text.primary }}>
            {t('admin.orders.openRisk', 'Why this order needs attention')}
          </Text>
          {order.risk_incidents.length === 0 ? (
            <Text style={[typography.body2, { color: colors.text.secondary }]}>
              {t('admin.orders.noOpenRisk', 'No open risk on this order.')}
            </Text>
          ) : (
            order.risk_incidents.map((incident) => (
              <View key={incident.id} style={{ gap: spacing.xxs }}>
                <Text style={[typography.body2, { color: colors.text.primary }]}>
                  {riskTypeLabel(t, incident.risk_type)}
                  {' · '}
                  {t('admin.orders.overdueBy', 'overdue by {{duration}}', {
                    duration: formatOverdue(t, incident.overdue_minutes),
                  })}
                </Text>
                {incident.reason ? (
                  <Text
                    style={[typography.caption, { color: colors.text.secondary }]}
                  >
                    {incident.reason}
                  </Text>
                ) : null}
                {incident.acknowledged_at ? (
                  <Text
                    style={[typography.caption, { color: colors.success.main }]}
                  >
                    {t(
                      'admin.orders.acknowledged',
                      'Acknowledged — repeat alerts paused'
                    )}
                  </Text>
                ) : null}
                <View style={[styles.row, { gap: spacing.xs }]}>
                  {!incident.acknowledged_at ? (
                    <Button
                      mode="outlined"
                      compact
                      disabled={detail.submitting}
                      onPress={() =>
                        runFromButton(() =>
                          detail.acknowledgeIncident(incident.id, {
                            resolve: false,
                          })
                        )
                      }
                    >
                      {t('admin.orders.acknowledgeAction', "I'm on it")}
                    </Button>
                  ) : null}
                  <Button
                    mode="contained"
                    compact
                    disabled={detail.submitting}
                    onPress={() => setResolveIncidentId(incident.id)}
                  >
                    {t('admin.credits.resolveAction', 'Resolve')}
                  </Button>
                </View>
                <Divider style={{ marginTop: spacing.xs }} />
              </View>
            ))
          )}
        </View>

        <View style={cardStyle}>
          <Text variant="titleMedium" style={{ color: colors.text.primary }}>
            {t('admin.orders.participants', 'People on this order')}
          </Text>
          {order.contacts.length === 0 ? (
            <Text style={[typography.body2, { color: colors.text.secondary }]}>
              {t(
                'admin.orders.noContacts',
                'No contact details are available for this order yet.'
              )}
            </Text>
          ) : (
            order.contacts.map((contact) => (
              <View key={contact.role} style={{ gap: spacing.xxs }}>
                <Text
                  style={[typography.caption, { color: colors.text.secondary }]}
                >
                  {contactRoleLabel(t, contact.role)}
                </Text>
                <Text style={[typography.body2, { color: colors.text.primary }]}>
                  {contact.name ??
                    t('admin.orders.unnamedContact', 'Name unavailable')}
                </Text>
                <Button
                  mode="contained-tonal"
                  compact
                  icon="message-outline"
                  disabled={!contact.can_message && !contact.can_sms}
                  onPress={() => setActiveContact(contact)}
                >
                  {t('admin.orders.contact', 'Contact')}
                </Button>
                <Divider style={{ marginTop: spacing.xs }} />
              </View>
            ))
          )}
        </View>

        {order.capabilities.can_redispatch ? (
          <View style={cardStyle}>
            <Text variant="titleMedium" style={{ color: colors.text.primary }}>
              {redispatchTitle}
            </Text>
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {hasAgent
                ? t(
                    'admin.orders.unassignInfoShort',
                    'Releases the current agent and looks for another one nearby.'
                  )
                : t(
                    'admin.orders.redispatchInfoShort',
                    'Offers this order to nearby agents again.'
                  )}
            </Text>
            <Button
              mode="contained"
              disabled={detail.submitting}
              loading={detail.submitting}
              onPress={() =>
                runFromButton(() =>
                  detail.redispatch('Mobile support intervention')
                )
              }
            >
              {redispatchTitle}
            </Button>
          </View>
        ) : null}

        <View style={cardStyle}>
          <Text variant="titleMedium" style={{ color: colors.text.primary }}>
            {t('admin.orders.timeline', 'Operational timeline')}
          </Text>
          {order.timeline.length === 0 ? (
            <Text style={[typography.body2, { color: colors.text.secondary }]}>
              {t(
                'admin.orders.noTimeline',
                'Nothing has happened on this order yet.'
              )}
            </Text>
          ) : (
            order.timeline.slice(0, 20).map((event) => (
              <View key={event.id}>
                <Text style={[typography.body2, { color: colors.text.primary }]}>
                  {statusText(event.event_type)}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.text.secondary }]}
                >
                  {new Date(event.created_at).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <AdminOrderContactSheet
        visible={!!activeContact}
        contact={activeContact}
        submitting={detail.submitting}
        onDismiss={() => setActiveContact(null)}
        onSend={handleSend}
      />

      <AdminOrderResolveSheet
        visible={!!resolveIncidentId}
        submitting={detail.submitting}
        onDismiss={() => setResolveIncidentId(null)}
        onSubmit={async (payload) => {
          if (!resolveIncidentId) return;
          await detail.resolveIncident(resolveIncidentId, payload);
        }}
      />

      <Snackbar
        visible={!!detail.feedback}
        onDismiss={detail.clearFeedback}
        duration={detail.feedback?.type === 'error' ? 6000 : 3000}
        style={{
          backgroundColor:
            detail.feedback?.type === 'error'
              ? colors.error.main
              : colors.success.main,
        }}
        action={{
          label: t('common.dismiss', 'Dismiss'),
          onPress: detail.clearFeedback,
        }}
      >
        {detail.feedback?.message ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
