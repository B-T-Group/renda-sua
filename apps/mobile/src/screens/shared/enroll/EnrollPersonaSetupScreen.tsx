import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { Banner, Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/stores/RootStore';
import { ReferralCodeEntryButton } from '@/components/signup/ReferralCodeEntryButton';
import {
  type AgentReferralLookupResult,
  useAgentReferralLookup,
} from '@/hooks/useAgentReferralLookup';
import { useAddresses } from '@/hooks/useAddresses';
import { useCompleteAddressPrompt } from '@/hooks/useCompleteAddressPrompt';
import {
  isAddressComplete,
  pickPrimaryOrFirstAddress,
} from '@/utils/addressCompleteness';
import type { EnrollStackParamList } from '@/navigation/types';
import {
  enrollCtaDefault,
  enrollCtaKey,
  enrollTitleDefault,
  enrollTitleKey,
} from '@/components/enroll/personaEnrollUi';
import { AgentFocusStep } from '@/components/signup/steps/AgentFocusStep';
import type { AgentFocus } from '@/types/agentFocus';

type Props = NativeStackScreenProps<EnrollStackParamList, 'EnrollPersonaSetup'>;

function EnrollPersonaSetupScreenBase({ navigation, route }: Props) {
  const { targetPersona } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const { persona } = useStore();

  const [businessName, setBusinessName] = useState('');
  const [mainInterest, setMainInterest] = useState<'sell_items' | 'rent_items'>('sell_items');
  const [agentFocus, setAgentFocus] = useState<AgentFocus | ''>('');
  const [referralAgentCode, setReferralAgentCode] = useState('');
  const [verifiedReferral, setVerifiedReferral] =
    useState<AgentReferralLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingAddress, setCheckingAddress] = useState(false);

  const { result: referralLookup, loading: referralLookupLoading, error: referralLookupError } =
    useAgentReferralLookup(referralAgentCode);
  const effectiveReferralLookup =
    referralLookup ??
    (referralLookupLoading &&
    verifiedReferral &&
    verifiedReferral.agentCode.toUpperCase() ===
      referralAgentCode.trim().toUpperCase()
      ? verifiedReferral
      : null);
  const { refetch: refetchAddresses } = useAddresses();
  const { openPrompt, Prompt: CompleteAddressPromptEl } = useCompleteAddressPrompt();

  const loading = persona.enrollingPersona === targetPersona || checkingAddress;

  const canSubmit = useMemo(() => {
    if (targetPersona === 'agent') return Boolean(agentFocus);
    if (targetPersona === 'business') return businessName.trim().length > 0;
    return false;
  }, [agentFocus, businessName, targetPersona]);

  const validateReferral = useCallback((): string | null => {
    const trimmed = referralAgentCode.trim();
    if (!trimmed) return null;
    if (trimmed.length !== 6) {
      return t('referrals.invalidCodeLength', 'Referral code must be 6 characters.');
    }
    if (referralLookupLoading && !effectiveReferralLookup) {
      return t('agent.referrals.lookupLoading', 'Looking up agent...');
    }
    if (
      !effectiveReferralLookup ||
      (referralLookupError && !effectiveReferralLookup) ||
      effectiveReferralLookup.agentCode !== trimmed.toUpperCase()
    ) {
      return t('agent.referrals.lookupError', 'No agent found for this code');
    }
    return null;
  }, [
    effectiveReferralLookup,
    referralAgentCode,
    referralLookupError,
    referralLookupLoading,
    t,
  ]);

  const enrollAndSucceed = useCallback(async () => {
    const trimmedReferral = referralAgentCode.trim();
    const referralPayload = trimmedReferral
      ? { referral_agent_code: trimmedReferral.toUpperCase() }
      : {};
    if (targetPersona === 'agent') {
      await persona.enrollPersona('agent', {
        vehicle_type_id: 'other',
        agent_focus: agentFocus || 'both',
        ...referralPayload,
      });
    } else if (targetPersona === 'business') {
      await persona.enrollPersona('business', {
        name: businessName.trim(),
        main_interest: mainInterest,
        ...referralPayload,
      });
    }
    navigation.replace('EnrollPersonaSuccess', { targetPersona });
  }, [
    agentFocus,
    businessName,
    mainInterest,
    navigation,
    persona,
    referralAgentCode,
    targetPersona,
  ]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const referralErr =
      targetPersona === 'business' || targetPersona === 'agent'
        ? validateReferral()
        : null;
    if (referralErr) {
      setError(referralErr);
      return;
    }

    try {
      if (targetPersona === 'business') {
        setCheckingAddress(true);
        const list = await refetchAddresses();
        const source = pickPrimaryOrFirstAddress(list ?? []);
        if (!isAddressComplete(source)) {
          setCheckingAddress(false);
          openPrompt({
            address: source,
            reason: 'enroll',
            onSaved: async () => {
              const refreshed = await refetchAddresses();
              const next = pickPrimaryOrFirstAddress(refreshed ?? []);
              if (!isAddressComplete(next)) {
                setError(
                  t(
                    'addresses.completePrompt.saveError',
                    'Could not save address. Try again.'
                  )
                );
                return;
              }
              try {
                await enrollAndSucceed();
              } catch (e: unknown) {
                const msg =
                  e instanceof Error
                    ? e.message
                    : t('enrollPersona.errors.generic', 'Could not add this role.');
                setError(msg);
              }
            },
          });
          return;
        }
        setCheckingAddress(false);
      }
      await enrollAndSucceed();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('enrollPersona.errors.generic', 'Could not add this role.');
      setError(msg);
      setCheckingAddress(false);
    }
  }, [
    enrollAndSucceed,
    openPrompt,
    refetchAddresses,
    t,
    targetPersona,
    validateReferral,
  ]);

  useEffect(() => {
    if (targetPersona === 'client') {
      navigation.replace('EnrollPersonaExplain', { targetPersona });
    }
  }, [navigation, targetPersona]);

  if (targetPersona === 'client') {
    return null;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackground, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: spacing.md }]}>
        <Text variant="headlineSmall" style={{ color: colors.text.primary, fontWeight: '700', marginBottom: 8 }}>
          {t(enrollTitleKey(targetPersona), enrollTitleDefault(targetPersona))}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 20 }}>
          {t('enrollPersona.setup.subtitle', 'A few details before we add this role to your account.')}
        </Text>

        {targetPersona === 'agent' ? (
          <>
            <Banner visible icon="information-outline">
              {t(
                'enrollPersona.agent.setupNote',
                'We will register you with a general vehicle type. You can update details later in your profile.'
              )}
            </Banner>
            <View style={{ marginTop: 12 }}>
              <AgentFocusStep
                value={agentFocus}
                disabled={loading}
                onChange={setAgentFocus}
              />
            </View>
            <View style={{ marginTop: 12 }}>
              <ReferralCodeEntryButton
                value={referralAgentCode}
                onChange={setReferralAgentCode}
                onVerifiedLookup={setVerifiedReferral}
                disabled={loading}
              />
            </View>
          </>
        ) : null}

        {targetPersona === 'business' ? (
          <>
            <TextInput
              mode="outlined"
              label={t('auth.signupFlow.businessName', 'Business name')}
              value={businessName}
              onChangeText={setBusinessName}
              disabled={loading}
              style={{ marginBottom: 12 }}
            />
            <Text variant="labelLarge" style={{ color: colors.text.primary, marginBottom: 8 }}>
              {t('enrollPersona.business.focusLabel', 'What is your main focus?')}
            </Text>
            <SegmentedButtons
              value={mainInterest}
              onValueChange={(v) => setMainInterest(v as 'sell_items' | 'rent_items')}
              buttons={[
                {
                  value: 'sell_items',
                  label: t('enrollPersona.business.focusSell', 'Sell items'),
                  disabled: loading,
                },
                {
                  value: 'rent_items',
                  label: t('enrollPersona.business.focusRent', 'Rent & earn'),
                  disabled: loading,
                },
              ]}
              style={{ marginBottom: 8 }}
            />
            <ReferralCodeEntryButton
              value={referralAgentCode}
              onChange={setReferralAgentCode}
              onVerifiedLookup={setVerifiedReferral}
              disabled={loading}
            />
          </>
        ) : null}

        {error ? (
          <Banner visible icon="alert-circle-outline" style={{ marginTop: 12 }}>
            {error}
          </Banner>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: spacing.md, borderTopColor: colors.divider }]}>
        <Button
          mode="contained"
          onPress={() => void handleSubmit()}
          loading={loading}
          disabled={loading || !canSubmit}
        >
          {t(enrollCtaKey(targetPersona), enrollCtaDefault(targetPersona))}
        </Button>
        <Button mode="text" onPress={() => navigation.goBack()} disabled={loading} style={{ marginTop: 4 }}>
          {t('common.back', 'Back')}
        </Button>
      </View>

      {CompleteAddressPromptEl}
    </View>
  );
}

export const EnrollPersonaSetupScreen = observer(EnrollPersonaSetupScreenBase);

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  footer: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
