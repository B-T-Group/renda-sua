import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
  ActivationChecklistCard,
  type ActivationStep,
} from '../common/ActivationChecklistCard';
import { useAgentVerificationStatus } from '../../hooks/useAgentVerificationStatus';
import { useMobilePaymentPhones } from '../../hooks/useMobilePaymentPhones';
import { useAgentXafWallet } from '../../hooks/useAgentXafWallet';
import { useStore } from '../../stores/RootStore';
import { agentApi } from '../../services/agentApi';
import StorageService from '../../services/storage/StorageService';
import { STORAGE_KEYS } from '../../constants/storageKeys';

type Props = {
  hasCompletedDelivery?: boolean;
  onRefreshOrders?: () => Promise<void> | void;
};

export function AgentActivationChecklist({
  hasCompletedDelivery = false,
  onRefreshOrders,
}: Props) {
  const { t } = useTranslation();
  const { auth } = useStore();
  const navigation = useNavigation<any>();
  const { isVerified, idDocumentStatus, loading, refetch: refetchVerification } =
    useAgentVerificationStatus();
  const wallet = useAgentXafWallet(!!auth.isAuthenticated);
  const isStripeRail = wallet.isStripeRail;
  const stripeReady = wallet.stripeReady;
  const { hasVerifiedPhone, fetchPhones } = useMobilePaymentPhones(!isStripeRail);
  const [collapsed, setCollapsed] = useState(false);
  const [availabilityDone, setAvailabilityDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading) setReady(true);
  }, [loading]);

  useEffect(() => {
    let active = true;
    void StorageService.getString(STORAGE_KEYS.agentWentAvailable).then((v) => {
      if (active && v) setAvailabilityDone(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const identityDone = isStripeRail
    ? true
    : isVerified || idDocumentStatus === 'approved';
  const payoutDone = isStripeRail ? !!stripeReady : hasVerifiedPhone;
  const vehicleDone = isStripeRail ? payoutDone : identityDone;

  const goDocuments = useCallback(() => {
    navigation.navigate('Documents');
  }, [navigation]);

  const goStripe = useCallback(() => {
    navigation.navigate('AgentAccounts');
  }, [navigation]);

  const goOpenOrders = useCallback(() => {
    void (async () => {
      try {
        await agentApi.agents.setAvailability(true);
        setAvailabilityDone(true);
        await StorageService.setString(STORAGE_KEYS.agentWentAvailable, '1');
      } catch {
        // Keep step incomplete when the availability API fails.
      }
      navigation.navigate('OpenOrders');
    })();
  }, [navigation]);

  const refreshChecklist = useCallback(async () => {
    setRefreshing(true);
    try {
      const tasks: Array<Promise<unknown>> = [
        refetchVerification(),
        wallet.refetchStripe(),
        wallet.refetch(),
      ];
      if (!isStripeRail) tasks.push(fetchPhones());
      if (onRefreshOrders) tasks.push(Promise.resolve(onRefreshOrders()));
      await Promise.all(tasks);
      const went = await StorageService.getString(STORAGE_KEYS.agentWentAvailable);
      setAvailabilityDone(!!went);
    } finally {
      setRefreshing(false);
    }
  }, [
    fetchPhones,
    isStripeRail,
    onRefreshOrders,
    refetchVerification,
    wallet.refetch,
    wallet.refetchStripe,
  ]);

  const steps: ActivationStep[] = useMemo(() => {
    const list: ActivationStep[] = [];
    if (!isStripeRail) {
      list.push({
        id: 'verify',
        label: t('ftue.checklist.agentVerify', 'Verify your identity'),
        done: identityDone,
        current: !identityDone,
        onPress: goDocuments,
      });
    }
    list.push(
      {
        id: 'payout',
        label: t('ftue.checklist.agentPayout', 'Add payout details'),
        done: payoutDone,
        current: identityDone && !payoutDone,
        onPress: isStripeRail ? goStripe : goDocuments,
      },
      {
        id: 'vehicle',
        label: t('ftue.checklist.agentVehicle', 'Confirm your vehicle'),
        done: vehicleDone,
        current: identityDone && payoutDone && !vehicleDone,
      },
      {
        id: 'available',
        label: t('ftue.checklist.agentAvailable', 'Go available'),
        done: availabilityDone || hasCompletedDelivery,
        current:
          identityDone &&
          payoutDone &&
          vehicleDone &&
          !availabilityDone &&
          !hasCompletedDelivery,
        onPress: goOpenOrders,
      },
      {
        id: 'first_delivery',
        label: t('ftue.checklist.agentFirstDelivery', 'Complete your first delivery'),
        done: hasCompletedDelivery,
        current:
          identityDone &&
          payoutDone &&
          vehicleDone &&
          (availabilityDone || hasCompletedDelivery) &&
          !hasCompletedDelivery,
        onPress: goOpenOrders,
      }
    );
    return list;
  }, [
    availabilityDone,
    goDocuments,
    goOpenOrders,
    goStripe,
    hasCompletedDelivery,
    identityDone,
    isStripeRail,
    payoutDone,
    t,
    vehicleDone,
  ]);

  if (!ready) return null;

  return (
    <ActivationChecklistCard
      persona="agent"
      title={t('ftue.checklist.agentTitle', 'Activate your delivery account')}
      steps={steps}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((v) => !v)}
      onRefresh={() => void refreshChecklist()}
      refreshing={refreshing}
    />
  );
}
