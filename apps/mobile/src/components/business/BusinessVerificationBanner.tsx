import React, { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SUPPORT_EMAIL, supportMailto } from '../../constants/support';
import { useTheme } from '../../contexts/ThemeContext';
import { NoticeBanner } from '../common/NoticeBanner';
import { useBusinessVerificationStatus } from '../../hooks/useBusinessVerificationStatus';
import { businessVerificationApi } from '../../services/businessVerificationApi';
import type { BusinessVerificationStatus } from '../../services/businessVerificationApi';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { suspendedReasonMessage } from '../../utils/suspendedReasonMessage';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

type Props = {
  statusOverride?: BusinessVerificationStatus | null;
  loadingOverride?: boolean;
  onRefreshStatus?: () => Promise<void> | void;
  mainInterest?: 'sell_items' | 'rent_items';
};

type SetupStep = {
  key: string;
  label: string;
  complete: boolean;
  current: boolean;
};

function SetupStepRow({
  step,
  accent,
  muted,
}: {
  step: SetupStep;
  accent: string;
  muted: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <MaterialCommunityIcons
        name={step.complete ? 'check-circle' : 'checkbox-blank-circle-outline'}
        size={18}
        color={step.complete ? accent : muted}
      />
      <Text
        variant="labelSmall"
        style={{
          color: step.complete || step.current ? accent : muted,
          fontWeight: step.current ? '700' : '400',
          flex: 1,
          minWidth: 0,
        }}
      >
        {step.label}
      </Text>
    </View>
  );
}

export function BusinessVerificationBanner({
  statusOverride,
  loadingOverride,
  onRefreshStatus,
}: Props = {}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const useInternalStatus = statusOverride === undefined;
  const internal = useBusinessVerificationStatus(useInternalStatus);
  const status = statusOverride !== undefined ? statusOverride : internal.status;
  const loading = loadingOverride !== undefined ? loadingOverride : internal.loading;
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await businessVerificationApi.refreshContract();
      if (onRefreshStatus) {
        await onRefreshStatus();
      } else if (useInternalStatus) {
        await internal.refetch();
      }
    } finally {
      setRefreshing(false);
    }
  }, [internal, onRefreshStatus, useInternalStatus]);

  if (loading || !status || status.can_accept_orders) {
    return null;
  }

  // MM merchants use dedicated dashboard cards (ID review + phone reminder +
  // verified-badge tip). Keep this banner for Stripe setup and suspended stores.
  if (
    status.lifecycle_status !== 'suspended' &&
    status.paymentRail === 'mobile_money'
  ) {
    return null;
  }

  if (status.lifecycle_status === 'suspended') {
    const reasonText = suspendedReasonMessage(status.suspension?.code, t);
    const emailSupport = () => {
      void Linking.openURL(
        supportMailto(
          t(
            'business.lifecycle.suspendedEmailSubject',
            'Store suspension appeal'
          ),
          t(
            'business.lifecycle.suspendedEmailBody',
            'Hello,\n\nMy store appears to be suspended. Please review my account.\n\nThank you.'
          )
        )
      );
    };
    return (
      <NoticeBanner
        tone="error"
        icon="pause-circle-outline"
        title={t('business.lifecycle.suspendedTitle', 'Store suspended')}
        message={`${reasonText}\n\n${t(
          'business.lifecycle.suspendedNotice',
          'Your store is hidden and cannot accept orders. Email {{email}} if you believe this is a mistake.',
          { email: SUPPORT_EMAIL }
        )}`}
        actionLabel={t('business.lifecycle.emailSupport', 'Email {{email}}', {
          email: SUPPORT_EMAIL,
        })}
        onAction={emailSupport}
        style={{ marginBottom: 16 }}
      />
    );
  }

  const agreementDone = status.steps.agreement?.complete === true;
  const setupSteps: SetupStep[] = [
    {
      key: 'agreement',
      label: t('business.verification.stepAgreement', 'Agreement'),
      complete: agreementDone,
      current: status.nextAction === 'sign_agreement',
    },
  ];

  const actionLabel =
    status.nextAction === 'sign_agreement'
      ? status.contract?.boldSignEnabled
        ? t('business.contract.viewStatus', 'View signing status')
        : t('business.verification.signAgreement', 'Sign merchant agreement')
      : undefined;

  const onAction =
    status.nextAction === 'sign_agreement'
      ? () => navigation.navigate('BusinessMerchantAgreement')
      : undefined;

  return (
    <NoticeBanner
      tone="warning"
      icon="shield-alert-outline"
      title={t('business.lifecycle.setupTitle', 'Finish setting up your store')}
      message={t(
        'business.lifecycle.setupNotice',
        'Sign the merchant agreement to go live and start accepting orders.'
      )}
      actionLabel={actionLabel}
      onAction={onAction}
      secondaryActionLabel={t('common.refresh', 'Refresh')}
      onSecondaryAction={() => void handleRefresh()}
      secondaryActionLoading={refreshing}
      style={{ marginBottom: 16 }}
    >
      <View style={{ gap: 6 }}>
        {setupSteps.map((step) => (
          <SetupStepRow
            key={step.key}
            step={step}
            accent={colors.warning.dark}
            muted={colors.text.secondary}
          />
        ))}
      </View>
    </NoticeBanner>
  );
}
