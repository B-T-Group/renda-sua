import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfileMe } from '@/hooks/useProfileMe';
import { useBusinessAccountType } from '@/hooks/business/useBusinessAccountType';
import { BusinessAccountPlanCard } from '@/components/business/BusinessAccountPlanCard';
import { AccountTypeTiersVector } from '@/components/illustrations/AccountTypeTiersVector';
import type { BusinessAccountTypeId, BusinessAccountTypePlan } from '@/types/business/accountType';

function BusinessAccountTypeScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { me, refetch } = useProfileMe();

  const accountType = me?.business?.account_type;
  const lockedUntil = me?.business?.account_type_locked_until;

  const onSuccess = useCallback(async () => {
    await refetch({ silent: true });
  }, [refetch]);

  const {
    currentType,
    plan: currentPlan,
    plans,
    isLocked,
    lockedMessage,
    loading,
    error,
    changeAccountType,
  } = useBusinessAccountType(accountType, lockedUntil, onSuccess);

  const [selectedPlan, setSelectedPlan] = useState<BusinessAccountTypePlan | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleSelect = (plan: BusinessAccountTypePlan) => {
    if (plan.id === currentType || isLocked) return;
    setSelectedPlan(plan);
    setConfirmVisible(true);
  };

  const handleConfirm = async () => {
    if (!selectedPlan) return;
    try {
      await changeAccountType(selectedPlan.id as BusinessAccountTypeId);
      setConfirmVisible(false);
      setSelectedPlan(null);
    } catch {
      // error shown via hook state
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackground }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl, paddingTop: spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.illustrationRow}>
          <AccountTypeTiersVector size={112} />
        </View>

        <Text
          variant="headlineSmall"
          style={[styles.heading, { color: colors.text.primary }]}
        >
          {t('business.accountType.pageHeading', 'Choose Your Business Plan')}
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.subheading, { color: colors.text.secondary }]}
        >
          {t(
            'business.accountType.pageSubheading',
            'Every business starts on Standard for free and can upgrade anytime as it grows.'
          )}
        </Text>

        {isLocked && lockedMessage ? (
          <View
            style={[
              styles.lockBanner,
              {
                backgroundColor: `${colors.warning.main}18`,
                borderColor: colors.warning.main,
              },
            ]}
          >
            <Text variant="bodySmall" style={{ color: colors.warning.dark }}>
              {lockedMessage}
            </Text>
          </View>
        ) : (
          <Text
            variant="bodySmall"
            style={[styles.lockNote, { color: colors.text.secondary }]}
          >
            {t(
              'business.accountType.lockInNote',
              'After changing your plan, a 30-day commitment period begins.'
            )}
          </Text>
        )}

        {plans.map((plan) => (
          <BusinessAccountPlanCard
            key={plan.id}
            plan={plan}
            isCurrent={plan.id === currentType}
            isLocked={isLocked}
            onSelect={handleSelect}
          />
        ))}

        {error ? (
          <Text
            variant="bodySmall"
            style={[styles.errorText, { color: colors.error.main }]}
          >
            {error}
          </Text>
        ) : null}

        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.primary.main}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </ScrollView>

      {confirmVisible && selectedPlan ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmVisible(false)}
          statusBarTranslucent
        >
          <Pressable style={styles.scrim} onPress={() => setConfirmVisible(false)}>
            <Pressable
              style={[
                styles.sheet,
                shadows.lg,
                {
                  borderRadius: borderRadius.xl,
                  backgroundColor: colors.surface,
                  maxHeight: screenHeight * 0.6,
                  marginBottom: insets.bottom + spacing.lg,
                  borderTopWidth: 4,
                  borderTopColor: selectedPlan.color,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text
                variant="titleLarge"
                style={{ color: colors.text.primary, fontWeight: '700', marginBottom: 12 }}
              >
                {t('business.accountType.confirmTitle', 'Change to {{plan}}?', {
                  plan: t(selectedPlan.labelKey, selectedPlan.defaultLabel),
                })}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: colors.text.secondary, marginBottom: spacing.md }}
              >
                {t(
                  'business.accountType.confirmMessage',
                  'You are switching from {{from}} ({{fromPct}}% commission) to {{to}} ({{toPct}}% commission). This plan will be locked for 30 days after confirming.',
                  {
                    from: t(currentPlan.labelKey, currentPlan.defaultLabel),
                    fromPct: currentPlan.commissionPercent,
                    to: t(selectedPlan.labelKey, selectedPlan.defaultLabel),
                    toPct: selectedPlan.commissionPercent,
                  }
                )}
              </Text>
              {error ? (
                <Text
                  variant="bodySmall"
                  style={{ color: colors.error.main, marginBottom: spacing.sm }}
                >
                  {error}
                </Text>
              ) : null}
              <View style={styles.sheetActions}>
                <Button
                  mode="text"
                  onPress={() => setConfirmVisible(false)}
                  textColor={colors.text.secondary}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  mode="contained"
                  onPress={handleConfirm}
                  loading={loading}
                  disabled={loading}
                  buttonColor={selectedPlan.color}
                  textColor={colors.onDark}
                >
                  {t('business.accountType.confirmChangeBtn', 'Confirm Change')}
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  illustrationRow: { alignItems: 'center', marginBottom: 16 },
  heading: { textAlign: 'center', marginBottom: 8, fontWeight: '700' },
  subheading: { textAlign: 'center', marginBottom: 16 },
  lockBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  lockNote: { textAlign: 'center', marginBottom: 20 },
  errorText: { textAlign: 'center', marginTop: 8 },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  sheet: { padding: 20 },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});

export default observer(BusinessAccountTypeScreen);
