import { Image, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { IconButton, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import type { BusinessOrder } from '../../types/business/orders';
import { orderListHeroImageUrl, orderStatusStripeColor } from '../../utils/clientOrderListDisplay';

type Props = {
  order: BusinessOrder;
  locale: string;
  onRefetch: () => void;
};

function formatWhen(locale: string, iso: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

export function BusinessOrderHeroCard({ order, locale, onRefetch }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const status = order.current_status || 'unknown';
  const statusLabel = t(`common.orderStatus.${status}`, status.replace(/_/g, ' '));
  const stripeColor = orderStatusStripeColor(status, colors);
  const heroUri = orderListHeroImageUrl(order);
  const pendingCash = order.reconciliation_status === 'pending_manual_reconciliation';

  return (
    <View
      style={{
        flexDirection: 'row',
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.divider,
        gap: spacing.md,
      }}
    >
      {heroUri ? (
        <Image
          source={{ uri: heroUri }}
          style={{ width: 72, height: 72, borderRadius: borderRadius.sm, backgroundColor: colors.divider }}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Text variant="headlineSmall" style={{ color: colors.primary.main, fontWeight: '700', flex: 1 }}>
            #{order.order_number}
          </Text>
          <IconButton
            icon="refresh"
            mode="contained-tonal"
            size={20}
            onPress={onRefetch}
            accessibilityLabel={t('common.refresh', 'Refresh')}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xxs }}>
          <StatusPill
            compact
            label={statusLabel}
            backgroundColor={stripeColor + '28'}
            borderColor={stripeColor + '55'}
            textColor={colors.text.primary}
          />
          {pendingCash ? (
            <StatusPill
              compact
              icon="cash"
              label={t('business.orders.cashPending', 'Cash recon.')}
              backgroundColor={colors.warningTint}
              textColor={colors.text.primary}
            />
          ) : null}
          {order.requires_fast_delivery ? (
            <StatusPill
              compact
              label={t('orders.fastDelivery.title', 'Fast delivery')}
              backgroundColor={`${colors.error.light}44`}
              textColor={colors.error.dark}
            />
          ) : null}
        </View>
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
          {t('business.orders.detailPlaced', 'Placed')} {formatWhen(locale, order.created_at)}
        </Text>
      </View>
    </View>
  );
}
