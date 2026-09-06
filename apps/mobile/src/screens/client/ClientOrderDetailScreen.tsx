import { useEffect, useLayoutEffect } from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { OrderMessageHeaderButton } from '../../components/orders/OrderMessageHeaderButton';
import { useTheme } from '../../contexts/ThemeContext';
import OrderDetailClientView from '../shared/orderDetail/OrderDetailClientView';
import type { OrderDetailScreenProps } from '../shared/orderDetail/types';

type Props = OrderDetailScreenProps;

function ClientOrderDetailScreenBase(props: Props) {
  const { navigation, route } = props;
  const { orderId, openMessages, highlightMessageId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('orders.detailScreenTitle', 'Order detail'),
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginLeft: 8, paddingVertical: 4, justifyContent: 'center' }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
        </Pressable>
      ),
      headerRight: () => (
        <OrderMessageHeaderButton
          onPress={() =>
            navigation.navigate('OrderMessages', {
              orderId,
              highlightMessageId,
            })
          }
        />
      ),
    });
  }, [navigation, t, colors.text.primary, orderId, highlightMessageId]);

  useEffect(() => {
    if (!openMessages) return;
    navigation.setParams({ openMessages: undefined });
    navigation.navigate('OrderMessages', { orderId, highlightMessageId });
  }, [openMessages, orderId, highlightMessageId, navigation]);

  return <OrderDetailClientView {...props} />;
}

export default observer(ClientOrderDetailScreenBase);
