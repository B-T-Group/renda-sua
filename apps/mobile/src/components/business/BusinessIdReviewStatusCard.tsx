import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { shadows } from '../../theme';
import { StatusPill } from '../common/StatusPill';
import { IdReviewIllustration } from '../illustrations/IdReviewIllustration';
import type { BusinessVerificationStatus } from '../../services/businessVerificationApi';
import type { BusinessRootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

type Props = {
  status: BusinessVerificationStatus;
  onRefresh?: () => Promise<void> | void;
};

export function BusinessIdReviewStatusCard({ status, onRefresh }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation<Nav>();
  const [refreshing, setRefreshing] = useState(false);

  const identity = status.steps.identity;
  if (!identity || identity.status === 'approved' || identity.status === 'missing') {
    return null;
  }

  const rejected = identity.status === 'rejected';
  const reason = identity.rejectionReason?.trim() || '';
  const borderAccent = rejected ? colors.error.main : colors.info.main;
  const tintBg = rejected ? colors.errorTint : colors.infoTint;

  const onReupload = () => {
    navigation.navigate('Documents', { returnToDashboard: true });
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: borderAccent,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
      accessibilityRole="summary"
    >
      <View style={styles.hero}>
        <IdReviewIllustration />
      </View>

      <View style={styles.headerRow}>
        <StatusPill
          label={
            rejected
              ? t('business.idReview.pillRejected', 'ID rejected')
              : t('business.idReview.pillPending', 'ID under review')
          }
          backgroundColor={tintBg}
          textColor={rejected ? colors.error.dark : colors.info.dark}
          icon={rejected ? 'alert-circle' : 'clock-outline'}
        />
      </View>

      <Text
        variant="titleMedium"
        style={{ color: colors.text.primary, fontWeight: '700', marginTop: spacing.sm }}
      >
        {rejected
          ? t('business.idReview.rejectedTitle', 'Please reupload your ID')
          : t('business.idReview.pendingTitle', 'We’re reviewing your ID')}
      </Text>

      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginTop: 6, lineHeight: 21 }}
      >
        {rejected
          ? t(
              'business.idReview.rejectedBody',
              'Your identification was not approved. Upload a clearer valid government ID to continue.'
            )
          : t(
              'business.idReview.pendingBody',
              'Your account dashboard is ready. We’ll activate your store once your ID is approved.'
            )}
      </Text>

      {rejected && reason ? (
        <View
          style={[
            styles.reasonBox,
            {
              backgroundColor: tintBg,
              borderRadius: borderRadius.md,
              marginTop: spacing.sm,
              padding: spacing.sm,
            },
          ]}
        >
          <Text variant="labelSmall" style={{ color: colors.error.dark, fontWeight: '700' }}>
            {t('business.setup.identityRejectionReasonPrefix', 'Reason:')}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.primary, marginTop: 4 }}
            numberOfLines={6}
          >
            {reason}
          </Text>
        </View>
      ) : null}

      {rejected ? (
        <Button
          mode="contained"
          onPress={onReupload}
          buttonColor={colors.error.main}
          style={{ marginTop: spacing.md }}
          contentStyle={styles.cta}
        >
          {t('business.setup.ctaReuploadIdentity', 'Reupload ID')}
        </Button>
      ) : (
        <Button
          mode="outlined"
          loading={refreshing}
          onPress={() => void handleRefresh()}
          style={{ marginTop: spacing.md }}
          contentStyle={styles.cta}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reasonBox: {},
  cta: {
    minHeight: 48,
  },
});
