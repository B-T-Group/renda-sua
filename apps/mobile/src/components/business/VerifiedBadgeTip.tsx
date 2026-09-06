import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NoticeBanner } from '../common/NoticeBanner';
import type { BusinessVerificationStatus } from '../../services/businessVerificationApi';
import type { BusinessRootStackParamList } from '../../navigation/types';
import {
  isVerifiedBadgeTipDismissed,
  markVerifiedBadgeTipDismissed,
  shouldShowVerifiedBadgeTip,
} from '../../utils/verifiedBadgeTip';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

type Props = {
  status: BusinessVerificationStatus;
  businessId: string | undefined;
};

export function VerifiedBadgeTip({ status, businessId }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!businessId) {
        if (!cancelled) {
          setDismissed(false);
          setLoaded(true);
        }
        return;
      }
      const value = await isVerifiedBadgeTipDismissed(businessId);
      if (!cancelled) {
        setDismissed(value);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const visible = useMemo(
    () =>
      loaded && shouldShowVerifiedBadgeTip(status, businessId, dismissed),
    [loaded, status, businessId, dismissed]
  );

  const handleSkip = useCallback(async () => {
    if (!businessId) return;
    await markVerifiedBadgeTipDismissed(businessId);
    setDismissed(true);
  }, [businessId]);

  if (!visible || !businessId) return null;

  const isStripe = status.paymentRail === 'stripe';

  const message = isStripe
    ? t(
        'business.verifiedBadgeTip.bodyStripe',
        'Connect payouts to earn a Verified badge on your store. It helps customers trust your business.'
      )
    : t(
        'business.verifiedBadgeTip.bodyMm',
        'Upload an ID that matches the name on your profile to earn a Verified badge on your store. It gives clients more confidence.'
      );

  return (
    <NoticeBanner
      tone="info"
      icon="check-decagram"
      title={t('business.verifiedBadgeTip.title', 'Get a Verified badge')}
      message={message}
      actionLabel={
        isStripe
          ? t('stripe.connect.setup', 'Set up payouts')
          : t('business.verifiedBadgeTip.uploadId', 'Upload ID')
      }
      onAction={() => {
        if (isStripe) {
          navigation.navigate('BusinessConfigurePayments');
          return;
        }
        navigation.navigate('Documents', { returnToDashboard: true });
      }}
      secondaryActionLabel={t('business.verifiedBadgeTip.skip', 'Skip for now')}
      onSecondaryAction={() => void handleSkip()}
      style={{ marginBottom: 16 }}
    />
  );
}
