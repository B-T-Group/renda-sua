import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { SectionCard } from '../common/SectionCard';
import { InfoRow } from '../common/InfoRow';

export interface ShippingTrackingCardProps {
  carrier?: string | null;
  trackingNumber?: string | null;
  shippedAt?: string | null;
}

export function ShippingTrackingCard({
  carrier,
  trackingNumber,
  shippedAt,
}: ShippingTrackingCardProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const hasTracking = Boolean(trackingNumber || carrier);

  return (
    <SectionCard
      title={t('orders.shipping.trackingTitle', 'Shipment')}
      style={{ marginBottom: spacing.sm }}
    >
      {hasTracking ? (
        <View>
          {carrier ? (
            <InfoRow
              label={t('orders.shipping.carrier', 'Carrier')}
              value={carrier}
            />
          ) : null}
          {trackingNumber ? (
            <InfoRow
              label={t('orders.shipping.trackingNumber', 'Tracking number')}
              value={trackingNumber}
            />
          ) : null}
          {shippedAt ? (
            <InfoRow
              label={t('orders.shipping.shippedAt', 'Shipped')}
              value={new Date(shippedAt).toLocaleString()}
            />
          ) : null}
        </View>
      ) : (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t(
            'orders.shipping.preparing',
            'The seller is preparing your shipment.'
          )}
        </Text>
      )}
    </SectionCard>
  );
}
