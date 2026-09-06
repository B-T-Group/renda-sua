import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { StatusPill } from '@/components/common/StatusPill';
import { useTheme } from '@/contexts/ThemeContext';
import type {
  CreditsEscalationRow,
  CreditsFeedbackOrderRow,
  CreditsSummaryRow,
} from '@/types/adminCredits';

function personName(row: {
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
} | null | undefined): string {
  const name = `${row?.first_name ?? ''} ${row?.last_name ?? ''}`.trim();
  return name || row?.phone_number || '—';
}

export function CreditsEscalationCard({
  item,
  submitting,
  onResolve,
  onOpenOrder,
}: {
  item: CreditsEscalationRow;
  submitting: boolean;
  onResolve: () => void;
  onOpenOrder: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const critical = item.severity === 'critical';
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...(shadows.sm ?? {}),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          marginBottom: spacing.xs,
        }}
      >
        <Text
          style={[typography.body1, { color: colors.text.primary, flex: 1 }]}
          numberOfLines={1}
        >
          {item.order?.order_number ?? item.order_id}
        </Text>
        <StatusPill
          label={item.severity}
          compact
          backgroundColor={critical ? colors.errorTint : colors.warningTint}
          textColor={critical ? colors.error.main : colors.warning.main}
        />
      </View>
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {item.risk_type.replace(/_/g, ' ')} ·{' '}
        {personName(item.order?.client?.user)}
        {item.order?.client?.user?.country
          ? ` · ${item.order.client.user.country.toUpperCase()}`
          : ''}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.xs,
          marginTop: spacing.sm,
          flexWrap: 'wrap',
        }}
      >
        <Button
          mode="contained"
          compact
          disabled={submitting}
          onPress={onResolve}
          style={{ minHeight: 44 }}
        >
          {t('admin.credits.resolveAction', 'Resolve')}
        </Button>
        <Button
          mode="text"
          compact
          onPress={onOpenOrder}
          style={{ minHeight: 44 }}
        >
          {t('admin.credits.openOrder', 'Open order')}
        </Button>
      </View>
    </View>
  );
}

export function CreditsFeedbackCard({
  item,
  mode,
  submitting,
  onRecord,
  onOpenOrder,
}: {
  item: CreditsFeedbackOrderRow;
  mode: 'cancelled' | 'first_order';
  submitting: boolean;
  onRecord: () => void;
  onOpenOrder: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const when =
    mode === 'cancelled' ? item.cancelled_at : item.completed_at;
  const displayName = `${item.client?.user?.first_name ?? ''} ${
    item.client?.user?.last_name ?? ''
  }`.trim();
  const phone = item.client?.user?.phone_number;
  const first = item.order_items?.[0];
  const itemLabel = first
    ? [first.item_name, first.variant_name].filter(Boolean).join(' · ')
    : '';
  const fulfillment =
    item.fulfillment_method === 'pickup'
      ? t('admin.credits.fulfillment.pickup', 'Pickup')
      : item.fulfillment_method === 'shipping'
        ? t('admin.credits.fulfillment.shipping', 'Shipping')
        : item.fulfillment_method === 'delivery'
          ? t('admin.credits.fulfillment.delivery', 'Delivery')
          : item.fulfillment_method || null;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...(shadows.sm ?? {}),
      }}
    >
      <Text style={[typography.body1, { color: colors.text.primary }]}>
        {item.order_number}
        {fulfillment ? ` · ${fulfillment}` : ''}
      </Text>
      {first ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginTop: spacing.xs,
          }}
        >
          {first.image_url ? (
            <Image
              source={{ uri: first.image_url }}
              style={{
                width: 44,
                height: 44,
                borderRadius: borderRadius.sm,
                backgroundColor: colors.divider,
              }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: borderRadius.sm,
                backgroundColor: colors.divider,
              }}
            />
          )}
          <Text
            style={[
              typography.caption,
              { color: colors.text.secondary, flex: 1, minWidth: 0 },
            ]}
            numberOfLines={2}
          >
            {first.quantity}× {itemLabel || '—'}
            {(item.order_items?.length ?? 0) > 1
              ? ` +${(item.order_items?.length ?? 0) - 1}`
              : ''}
          </Text>
        </View>
      ) : null}
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {displayName || '—'}
        {item.client?.user?.country
          ? ` · ${item.client.user.country.toUpperCase()}`
          : ''}
        {phone ? ` · ${phone}` : ''}
      </Text>
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {item.business?.name ? `${item.business.name} · ` : ''}
        {when ? new Date(when).toLocaleString() : item.current_status}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.xs,
          marginTop: spacing.sm,
          flexWrap: 'wrap',
        }}
      >
        <Button
          mode="contained"
          compact
          disabled={submitting}
          onPress={onRecord}
          style={{ minHeight: 44 }}
        >
          {t('admin.credits.recordFeedback', 'Record feedback')}
        </Button>
        <Button
          mode="text"
          compact
          onPress={onOpenOrder}
          style={{ minHeight: 44 }}
        >
          {t('admin.credits.openOrder', 'Open order')}
        </Button>
      </View>
    </View>
  );
}

export function CreditsProgressCard({ item }: { item: CreditsSummaryRow }) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const name =
    `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() ||
    item.email ||
    item.user_id;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...(shadows.sm ?? {}),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text
          style={[typography.body1, { color: colors.text.primary, flex: 1 }]}
          numberOfLines={1}
        >
          {name}
          {item.country ? ` · ${item.country.toUpperCase()}` : ''}
        </Text>
        <Text style={[typography.body1, { color: colors.text.primary }]}>
          {item.total_weight}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.xs,
          marginTop: spacing.xs,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {item.is_agent ? (
          <StatusPill
            label={t('common.agent', 'Agent')}
            compact
            backgroundColor={colors.primaryTint}
            textColor={colors.primary.main}
          />
        ) : null}
        {item.is_business ? (
          <StatusPill
            label={t('common.business', 'Business')}
            compact
            backgroundColor={colors.infoTint}
            textColor={colors.info.main}
          />
        ) : null}
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {t('admin.credits.creditCount', '{{count}} actions', {
            count: item.credit_count,
          })}
        </Text>
      </View>
    </View>
  );
}
