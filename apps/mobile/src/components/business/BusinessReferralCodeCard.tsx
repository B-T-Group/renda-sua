import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ReferralCodeCard } from '@/components/referrals/ReferralCodeCard';
import { useBusinessReferrals } from '@/hooks/useBusinessReferrals';
import type { BusinessRootStackParamList } from '@/navigation/types';

interface Props {
  showFollowUpCta?: boolean;
}

export function BusinessReferralCodeCard({ showFollowUpCta = true }: Props) {
  const { t } = useTranslation();
  const { summary, loading } = useBusinessReferrals();
  const navigation =
    useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();

  const handleFollowUp = useCallback(() => {
    const parent = navigation.getParent();
    if (parent) {
      (
        parent as { navigate: (name: 'BusinessReferredBusinesses') => void }
      ).navigate('BusinessReferredBusinesses');
      return;
    }
    navigation.navigate('BusinessReferredBusinesses');
  }, [navigation]);

  const code = summary?.businessCode?.trim() || '';
  if (loading || !code || !summary) {
    return null;
  }

  return (
    <ReferralCodeCard
      code={code}
      title={t(
        'business.referrals.sideCashTitle',
        'Earn on the side — refer businesses'
      )}
      amountHint={t('business.referrals.sideCashBody', {
        defaultValue:
          'Share your code. When a referred business is identified and adds at least {{minItems}} approved items, you earn {{amount}} {{currency}}.',
        minItems: summary.minApprovedItems,
        amount: summary.referralAmount,
        currency: summary.currency,
      })}
      helpText={t(
        'referrals.shareHint',
        'Share this code with businesses so they can enter it when they sign up.'
      )}
      followUpLabel={
        showFollowUpCta
          ? t('referrals.followUp.viewList', 'View referred businesses')
          : undefined
      }
      onFollowUpPress={showFollowUpCta ? handleFollowUp : undefined}
    />
  );
}
