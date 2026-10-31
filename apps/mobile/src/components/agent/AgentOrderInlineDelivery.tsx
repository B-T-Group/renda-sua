import { View } from 'react-native';
import {
  DeliveryEarningsCard,
  DeliveryPackageCard,
  DeliveryRequirementsCard,
  DeliveryStopsSection,
} from '../delivery';
import type { DeliveryEarnings, DeliveryOrderViewModel } from '../../orders/model';

type Props = {
  vm: DeliveryOrderViewModel;
  earnings: DeliveryEarnings | null;
  maskDeliveryContact: boolean;
};

/** Former ActiveDeliveryView body, inline for every status. No hero / window card. */
export function AgentOrderInlineDelivery({ vm, earnings, maskDeliveryContact }: Props) {
  return (
    <View>
      <DeliveryStopsSection stops={vm.stops} maskDeliveryContact={maskDeliveryContact} />
      <DeliveryPackageCard packageInfo={vm.packageInfo} />
      <DeliveryRequirementsCard requirements={vm.deliveryRequirements} />
      {earnings ? <DeliveryEarningsCard earnings={earnings} /> : null}
    </View>
  );
}
