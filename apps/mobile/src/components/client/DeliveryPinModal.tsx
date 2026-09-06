import { useTranslation } from 'react-i18next';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

export interface DeliveryPinModalProps {
  visible: boolean;
  pin: string | null;
  loading: boolean;
  onDismiss: () => void;
  /** `delivery` shares with agent; `pickup` shares with seller. */
  variant?: 'delivery' | 'pickup';
}

export function DeliveryPinModal({
  visible,
  pin,
  loading,
  onDismiss,
  variant = 'delivery',
}: DeliveryPinModalProps) {
  const { t } = useTranslation();
  const isPickup = variant === 'pickup';
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>
          {isPickup
            ? t('orders.deliveryPin.pickupTitle', 'Pickup PIN')
            : t('orders.deliveryPin.title', 'Delivery PIN')}
        </Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
            {isPickup
              ? t(
                  'orders.deliveryPin.shareWithSeller',
                  'Show this PIN to the seller so they can confirm your pickup.'
                )
              : t(
                  'orders.deliveryPin.shareWithAgent',
                  'Share this PIN with your delivery agent. They will enter it to complete the delivery.'
                )}
          </Text>
          {loading ? (
            <Text variant="bodyMedium">{t('common.loading', 'Loading...')}</Text>
          ) : pin ? (
            <Text
              variant="displaySmall"
              style={{ textAlign: 'center', letterSpacing: 6, fontFamily: 'monospace' }}
            >
              {pin}
            </Text>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('common.close', 'Close')}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
