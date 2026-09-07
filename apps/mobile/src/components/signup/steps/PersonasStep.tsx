import React, { useEffect, useRef } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import { PERSONA_ACCENT } from '../../../constants/personaTheme';
import { benefitPersonaFromSignupPersona } from '../../../constants/signupBenefits';
import type {
  SignupMainInterest,
  SignupStartPersona,
} from '../../../services/publicAuthApi';
import { PersonaPickIllustration } from '../../illustrations/PersonaPickIllustration';
import { ReferralCodeEntryButton } from '../ReferralCodeEntryButton';
import { PersonaBenefitBullets } from '../PersonaBenefitBullets';
import type { AgentReferralLookupResult } from '@/hooks/useAgentReferralLookup';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type PersonaOption = SignupStartPersona;

const PERSONA_ICONS: Record<
  PersonaOption,
  React.ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
  client: 'account-circle-outline',
  agent: 'bike-fast',
  business: 'store-outline',
};

const PERSONA_OPTIONS: PersonaOption[] = ['client', 'agent', 'business'];

const TAGLINE_DEFAULTS: Record<PersonaOption, string> = {
  client: 'Shop nearby · track every order',
  agent: 'Deliver on your schedule · get paid',
  business: 'List products · manage orders',
};

export interface PersonasStepProps {
  personas: SignupStartPersona[];
  businessName: string;
  mainInterest: SignupMainInterest;
  referralAgentCode: string;
  disabled?: boolean;
  onTogglePersona: (p: SignupStartPersona) => void;
  onChangeBusinessName: (v: string) => void;
  onChangeMainInterest: (v: SignupMainInterest) => void;
  onChangeReferralAgentCode: (v: string) => void;
  onVerifiedReferralLookup?: (result: AgentReferralLookupResult | null) => void;
}

function personaTitleKey(p: PersonaOption): string {
  if (p === 'client') return 'persona.clientTitle';
  if (p === 'agent') return 'persona.agentTitle';
  return 'persona.businessTitle';
}

function personaTaglineKey(p: PersonaOption): string {
  return `signup.benefits.${p}.tagline`;
}

function SelectedBenefitsPanel({
  persona,
  accent,
}: {
  persona: PersonaOption;
  accent: string;
}) {
  const { colors, borderRadius, spacing } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [persona, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.benefitsPanel,
        {
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
          borderColor: accent,
          padding: spacing.md,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <PersonaPickIllustration
        persona={persona}
        accent={accent}
        size={104}
        animate
      />
      <View style={{ marginTop: spacing.sm }}>
        <PersonaBenefitBullets
          persona={benefitPersonaFromSignupPersona(persona)}
          compact
        />
      </View>
    </Animated.View>
  );
}

export function PersonasStep({
  personas,
  businessName,
  mainInterest,
  referralAgentCode,
  disabled,
  onTogglePersona,
  onChangeBusinessName,
  onChangeMainInterest,
  onChangeReferralAgentCode,
  onVerifiedReferralLookup,
}: PersonasStepProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const selectedPersona = personas[0] ?? null;
  const hasBusiness = selectedPersona === 'business';

  const titleDefaults: Record<PersonaOption, string> = {
    client: 'Client',
    agent: 'Agent',
    business: 'Business',
  };

  const selectPersona = (p: PersonaOption) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onTogglePersona(p);
  };

  return (
    <View style={styles.wrap}>
      {PERSONA_OPTIONS.map((p) => {
        const selected = selectedPersona === p;
        const accent = PERSONA_ACCENT[p];
        const title = t(personaTitleKey(p), titleDefaults[p]);
        const tagline = t(personaTaglineKey(p), TAGLINE_DEFAULTS[p]);

        return (
          <View key={p} style={styles.cardStack}>
            <Pressable
              onPress={() => selectPersona(p)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !!disabled }}
              accessibilityLabel={title}
              style={({ pressed }) => [
                { opacity: pressed ? 0.92 : disabled ? 0.6 : 1 },
              ]}
            >
              <View
                style={[
                  styles.card,
                  {
                    borderRadius: borderRadius.lg,
                    borderColor: selected ? accent : colors.divider,
                    borderWidth: selected ? 2 : 1,
                    borderLeftWidth: 4,
                    borderLeftColor: accent,
                    backgroundColor: selected
                      ? `${accent}14`
                      : colors.surface,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.md,
                  },
                ]}
              >
                <View style={styles.cardRow}>
                  <MaterialCommunityIcons
                    name={PERSONA_ICONS[p]}
                    size={32}
                    color={accent}
                  />
                  <View style={styles.cardTextCol}>
                    <Text
                      variant="titleSmall"
                      style={{
                        fontWeight: '700',
                        color: colors.text.primary,
                      }}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{
                        color: colors.text.secondary,
                        marginTop: 2,
                      }}
                      numberOfLines={2}
                    >
                      {tagline}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={26}
                    color={selected ? accent : colors.text.disabled}
                  />
                </View>
              </View>
            </Pressable>

            {selected ? (
              <>
                <SelectedBenefitsPanel persona={p} accent={accent} />
                {p === 'agent' || p === 'business' ? (
                  <ReferralCodeEntryButton
                    value={referralAgentCode}
                    onChange={onChangeReferralAgentCode}
                    onVerifiedLookup={onVerifiedReferralLookup}
                    disabled={disabled}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}

      {hasBusiness ? (
        <View style={[styles.businessBlock, { marginTop: spacing.sm }]}>
          <TextInput
            mode="outlined"
            label={t('auth.signupFlow.businessName', 'Business name')}
            value={businessName}
            onChangeText={onChangeBusinessName}
            disabled={disabled}
            left={<TextInput.Icon icon="store-outline" />}
            style={styles.field}
          />
          <Text
            variant="labelLarge"
            style={{ color: colors.text.primary, marginBottom: 8 }}
          >
            {t('enrollPersona.business.focusLabel', 'What is your main focus?')}
          </Text>
          <SegmentedButtons
            value={mainInterest}
            onValueChange={(v) =>
              onChangeMainInterest(v as SignupMainInterest)
            }
            buttons={[
              {
                value: 'sell_items',
                label: t('enrollPersona.business.focusSell', 'Sell items'),
                disabled,
              },
              {
                value: 'rent_items',
                label: t('enrollPersona.business.focusRent', 'Rent & earn'),
                disabled,
              },
            ]}
            style={{ marginBottom: 12 }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  cardStack: { gap: 8 },
  card: {},
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTextCol: { flex: 1, minWidth: 0 },
  benefitsPanel: { borderWidth: 1.5 },
  businessBlock: {},
  field: { marginBottom: 8 },
});
