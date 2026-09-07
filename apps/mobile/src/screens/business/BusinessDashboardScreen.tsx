import React, { useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { useBusinessDashboardScreen } from '../../hooks/business/useBusinessDashboardScreen';
import { BusinessDashboardView } from './BusinessDashboardView';
import { useNotifications } from '../../hooks/useNotifications';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

function BusinessDashboardScreenBase() {
  const props = useBusinessDashboardScreen();
  const navigation = useNavigation<Nav>();
  const { unreadCount } = useNotifications();
  const onOpenNotifications = useCallback(
    () => navigation.navigate('NotificationsCenter'),
    [navigation]
  );
  return (
    <BusinessDashboardView
      {...props}
      onOpenNotifications={onOpenNotifications}
      notificationsUnreadCount={unreadCount}
      onDismissAllActions={() => void props.dismissAllActionsNeeded()}
    />
  );
}

export default observer(BusinessDashboardScreenBase);
