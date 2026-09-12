import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OrderPlacedSuccessView } from '../../components/client/OrderPlacedSuccessView';
import type { ClientRootStackParamList, OrderPlacedSuccessParams } from '../../navigation/types';

export default observer(function OrderPlacedSuccessScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const route = useRoute<RouteProp<{ OrderPlacedSuccess: OrderPlacedSuccessParams }, 'OrderPlacedSuccess'>>();
  const { orderNumbers, paymentTiming, paymentCompleted, cardAuthorized, fulfillment } =
    route.params;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerLeft: () => null,
      gestureEnabled: false,
    });
  }, [navigation]);

  return (
    <OrderPlacedSuccessView
      orderNumbers={orderNumbers}
      paymentTiming={paymentTiming}
      paymentCompleted={paymentCompleted}
      cardAuthorized={cardAuthorized}
      fulfillment={fulfillment}
      primaryAction={{
        label: t('client.placeOrder.successScreen.returnToDashboard', 'Return to dashboard'),
        onPress: () => navigation.navigate('ClientMainTabs', { screen: 'ClientBrowse' }),
      }}
      secondaryAction={{
        label: t('client.placeOrder.successScreen.viewOrders', 'My orders'),
        onPress: () => navigation.navigate('ClientMainTabs', { screen: 'ClientOrders' }),
      }}
    />
  );
});
