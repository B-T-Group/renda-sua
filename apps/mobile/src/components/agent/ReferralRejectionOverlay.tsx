import React from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { ReferralRejectionIllustration } from '../illustrations/ReferralRejectionIllustration';

function ReferralRejectionOverlayBase() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { referralRejection } = useStore();
  const payload = referralRejection.payload;

  return (
    <Modal
      visible={referralRejection.visible}
      transparent
      animationType="fade"
      onRequestClose={() => referralRejection.dismiss()}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={() => referralRejection.dismiss()}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              maxHeight: height * 0.85,
              paddingBottom: insets.bottom + spacing.md,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
            <ReferralRejectionIllustration />
          </View>
          <Text
            style={[
              typography.subheading,
              { color: colors.text.primary, textAlign: 'center' },
            ]}
          >
            {t(
              'admin.referralReview.rejectionOverlayTitle',
              'Referral payout rejected'
            )}
          </Text>
          {payload?.businessName ? (
            <Text
              style={[
                typography.body2,
                {
                  color: colors.text.secondary,
                  marginTop: spacing.xs,
                  textAlign: 'center',
                },
              ]}
            >
              {payload.businessName}
            </Text>
          ) : null}
          <Text
            style={[
              typography.body1,
              {
                color: colors.text.primary,
                marginTop: spacing.md,
                textAlign: 'center',
              },
            ]}
          >
            {payload?.rejectionReason ?? ''}
          </Text>
          <View style={{ marginTop: spacing.lg }}>
            <Button
              mode="contained"
              onPress={() => referralRejection.dismiss()}
            >
              {t('admin.referralReview.rejectionOverlayDismiss', 'Got it')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const ReferralRejectionOverlay = observer(ReferralRejectionOverlayBase);

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: { width: '100%' },
});
