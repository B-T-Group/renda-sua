import { useEffect, useLayoutEffect } from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OrderMessageHeaderButton } from '../../components/orders/OrderMessageHeaderButton';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import OrderDetailBusinessView from './OrderDetailBusinessView';

type Props = NativeStackScreenProps<BusinessRootStackParamList, 'BusinessOrderDetail'>;

export default function BusinessOrderDetailScreen(props: Props) {
  const { navigation, route } = props;
  const { orderId, openMessages, highlightMessageId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('business.orders.detailTitle', 'Order'),
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

  return <OrderDetailBusinessView {...props} />;
}
