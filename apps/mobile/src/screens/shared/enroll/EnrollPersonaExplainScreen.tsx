import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Banner, Button, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/stores/RootStore';
import { PERSONA_ACCENT } from '@/constants/personaTheme';
import { PersonaBenefitBullets } from '@/components/signup/PersonaBenefitBullets';
import type { SignupBenefitPersona } from '@/constants/signupBenefits';
import {
  ENROLL_PERSONA_ICONS,
  enrollCtaDefault,
  enrollCtaKey,
  enrollSubtitleDefault,
  enrollSubtitleKey,
  enrollTitleDefault,
  enrollTitleKey,
} from '@/components/enroll/personaEnrollUi';
import type { EnrollStackParamList } from '@/navigation/types';
import { useAddresses } from '@/hooks/useAddresses';
import { useCompleteAddressPrompt } from '@/hooks/useCompleteAddressPrompt';
import {
  isAddressComplete,
  pickPrimaryOrFirstAddress,
} from '@/utils/addressCompleteness';

type Props = NativeStackScreenProps<EnrollStackParamList, 'EnrollPersonaExplain'>;

const HOW_IT_WORKS_KEYS = ['step1', 'step2', 'step3'] as const;

function EnrollPersonaExplainScreenBase({ navigation, route }: Props) {
  const { targetPersona } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius } = useTheme();
  const { persona } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [checkingAddress, setCheckingAddress] = useState(false);
  const accent = PERSONA_ACCENT[targetPersona];
  const loading = persona.enrollingPersona === targetPersona || checkingAddress;
  const { refetch: refetchAddresses } = useAddresses();
  const { openPrompt, Prompt: CompleteAddressPromptEl } = useCompleteAddressPrompt();

  const proceedAfterAddress = useCallback(async () => {
    setError(null);
    if (targetPersona === 'client') {
      try {
        await persona.enrollPersona('client', {});
        navigation.replace('EnrollPersonaSuccess', { targetPersona });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : t('enrollPersona.errors.generic', 'Could not add this role.');
        setError(msg);
      }
      return;
    }
    navigation.navigate('EnrollPersonaSetup', { targetPersona });
  }, [navigation, persona, t, targetPersona]);

  const ensureAddressThenContinue = useCallback(async () => {
    setError(null);
    setCheckingAddress(true);
    try {
      const list = await refetchAddresses();
      const source = pickPrimaryOrFirstAddress(list ?? []);
      if (isAddressComplete(source)) {
        await proceedAfterAddress();
        return;
      }
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
          await proceedAfterAddress();
        },
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : t('enrollPersona.errors.generic', 'Could not add this role.');
      setError(msg);
    } finally {
      setCheckingAddress(false);
    }
  }, [openPrompt, proceedAfterAddress, refetchAddresses, t]);

  const handleContinue = useCallback(async () => {
    if (targetPersona === 'client' || targetPersona === 'business') {
      await ensureAddressThenContinue();
      return;
    }
    await proceedAfterAddress();
  }, [ensureAddressThenContinue, proceedAfterAddress, targetPersona]);

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackground, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: spacing.md }]}>
        <View style={[styles.hero, { backgroundColor: accent + '14', borderRadius: borderRadius.xl }]}>
          <MaterialCommunityIcons name={ENROLL_PERSONA_ICONS[targetPersona]} size={56} color={accent} />
        </View>

        <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
          {t(enrollTitleKey(targetPersona), enrollTitleDefault(targetPersona))}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 20 }}>
          {t(enrollSubtitleKey(targetPersona), enrollSubtitleDefault(targetPersona))}
        </Text>

        <PersonaBenefitBullets persona={targetPersona as SignupBenefitPersona} />

        <Text variant="titleSmall" style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {t('enrollPersona.howItWorks.title', 'How it works')}
        </Text>
        {HOW_IT_WORKS_KEYS.map((key, i) => (
          <Text key={key} variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 6 }}>
            {`${i + 1}. ${t(`enrollPersona.howItWorks.${key}`, `Step ${i + 1}`)}`}
          </Text>
        ))}

        <Banner visible icon="information-outline" style={{ marginTop: 16 }}>
          {t(
            'enrollPersona.whatYouKeep',
            'Same login and profile — roles are additive. Switch anytime from Profile or Menu.'
          )}
        </Banner>

        {targetPersona === 'agent' ? (
          <Banner visible icon="shield-check-outline" style={{ marginTop: 8 }}>
            {t(
              'enrollPersona.agent.verificationNote',
              'ID verification is required before you can accept deliveries. You can upload documents after switching.'
            )}
          </Banner>
        ) : null}

        {targetPersona === 'business' ? (
          <Banner visible icon="store-outline" style={{ marginTop: 8 }}>
            {t(
              'enrollPersona.business.catalogNote',
              'After switching, complete catalog onboarding to make items visible to buyers.'
            )}
          </Banner>
        ) : null}

        {error ? (
          <Banner visible icon="alert-circle-outline" style={{ marginTop: 12 }}>
            {error}
          </Banner>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: spacing.md, borderTopColor: colors.divider }]}>
        <Button mode="contained" onPress={() => void handleContinue()} loading={loading} disabled={loading}>
          {t(enrollCtaKey(targetPersona), enrollCtaDefault(targetPersona))}
        </Button>
        <Button mode="text" onPress={() => navigation.goBack()} disabled={loading} style={{ marginTop: 4 }}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </View>

      {CompleteAddressPromptEl}
    </View>
  );
}

export const EnrollPersonaExplainScreen = observer(EnrollPersonaExplainScreenBase);

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  hero: {
    alignSelf: 'flex-start',
    padding: 20,
    marginBottom: 20,
  },
  title: { fontWeight: '700', marginBottom: 8 },
  sectionTitle: { fontWeight: '600', marginTop: 24, marginBottom: 10 },
  footer: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
