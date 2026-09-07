import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
  ActivationChecklistCard,
  type ActivationStep,
} from '../common/ActivationChecklistCard';
import { ProgressCard } from '../common/ProgressCard';
import type { MeUser } from '../../types/me';
import type { UserAddress } from '../../types/agent';
import { isAddressComplete } from '../../utils/addressCompleteness';
import { useStore } from '../../stores/RootStore';
import { useClientOrders } from '../../hooks/useClientOrders';

type Props = {
  me: MeUser | null;
  addresses?: UserAddress[];
  /** Optional override; defaults to client order history. */
  hasPlacedOrder?: boolean;
  hasLeftReview?: boolean;
  onAddAddress?: () => void;
  onVerifyPhone?: () => void;
  compact?: boolean;
};

export function CustomerActivationChecklist({
  me,
  addresses = [],
  hasPlacedOrder: hasPlacedOrderProp,
  hasLeftReview = false,
  onAddAddress,
  onVerifyPhone,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const { ftue } = useStore();
  const navigation = useNavigation<any>();
  const [collapsed, setCollapsed] = useState(true);
  const { orders } = useClientOrders(true);
  const hasPlacedOrder =
    hasPlacedOrderProp ?? orders.some((o) => o.current_status !== 'cancelled');

  const hasBrowsed = ftue.browseCounters.productViews > 0;
  const hasAccount = true;
  const hasAddress = addresses.some((a) => isAddressComplete(a));
  const hasPhoneVerified = me?.phone_number_verified === true;

  const goBrowse = useCallback(() => {
    navigation.navigate('ClientMainTabs', { screen: 'ClientBrowse' });
  }, [navigation]);

  const goOrders = useCallback(() => {
    navigation.navigate('ClientMainTabs', { screen: 'ClientOrders' });
  }, [navigation]);

  const steps: ActivationStep[] = useMemo(
    () => [
      {
        id: 'browse',
        label: t('ftue.checklist.customerBrowse', 'Browse products'),
        done: hasBrowsed,
        current: !hasBrowsed,
        onPress: goBrowse,
      },
      {
        id: 'account',
        label: t('ftue.checklist.customerAccount', 'Create an account'),
        done: hasAccount,
      },
      {
        id: 'address',
        label: t('ftue.checklist.customerAddress', 'Save a delivery address'),
        done: hasAddress,
        current: hasBrowsed && !hasAddress,
        onPress: onAddAddress,
      },
      {
        id: 'phone',
        label: t('ftue.checklist.customerPhone', 'Verify your phone'),
        done: hasPhoneVerified,
        current: hasAddress && !hasPhoneVerified,
        onPress: onVerifyPhone,
      },
      {
        id: 'order',
        label: t('ftue.checklist.customerOrder', 'Place your first order'),
        done: hasPlacedOrder,
        current: hasPhoneVerified && !hasPlacedOrder,
        onPress: goBrowse,
      },
      {
        id: 'review',
        label: t('ftue.checklist.customerReview', 'Leave a review'),
        done: hasLeftReview,
        current: hasPlacedOrder && !hasLeftReview,
        onPress: goOrders,
      },
    ],
    [
      goBrowse,
      goOrders,
      hasAddress,
      hasBrowsed,
      hasLeftReview,
      hasPhoneVerified,
      hasPlacedOrder,
      onAddAddress,
      onVerifyPhone,
      t,
    ]
  );

  const done = steps.filter((s) => s.done).length;

  if (compact) {
    return (
      <ProgressCard
        title={t('ftue.checklist.customerTitle', 'Get the most from RendaSua')}
        done={done}
        total={steps.length}
      />
    );
  }

  return (
    <ActivationChecklistCard
      persona="client"
      title={t('ftue.checklist.customerTitle', 'Get the most from RendaSua')}
      steps={steps}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((v) => !v)}
    />
  );
}
