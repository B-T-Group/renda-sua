import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { AddressCard, ContactCard } from '../orders/shared';
import type { DeliveryStopView } from '../../orders/model';

export interface DeliveryStopsSectionProps {
  stops: DeliveryStopView[];
  /** When true, hide customer contact on the delivery stop (unclaimed orders). */
  maskDeliveryContact?: boolean;
}

function contactTitle(
  kind: DeliveryStopView['kind'],
  t: (key: string, defaultValue: string) => string
): string {
  return kind === 'pickup'
    ? t('orders.delivery.actions.contactBusiness', 'Contact Business')
    : t('orders.delivery.actions.contactCustomer', 'Contact Customer');
}

export function DeliveryStopsSection({
  stops,
  maskDeliveryContact = false,
}: DeliveryStopsSectionProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  return (
    <View style={[styles.wrap, { gap: spacing.md, marginBottom: spacing.md }]}>
      {stops.map((stop) => {
        const hideContact = maskDeliveryContact && stop.kind === 'delivery';
        return (
          <View key={stop.kind} style={{ gap: spacing.sm }}>
            <AddressCard
              title={stop.title}
              address={stop.address}
              instructions={stop.instructions}
              showNavigate
            />
            <ContactCard
              title={contactTitle(stop.kind, t)}
              contact={hideContact ? null : stop.contact}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
});
