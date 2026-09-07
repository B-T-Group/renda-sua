import React from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { PERSONA_ACCENT } from '../../../constants/personaTheme';
import { useTheme } from '../../../contexts/ThemeContext';
import type { AgentReferralLookupResult } from '../../../hooks/useAgentReferralLookup';
import type { SignupMainInterest, SignupStartPersona } from '../../../services/publicAuthApi';
import type { DeliveryAddressFormValue } from '../../forms/DeliveryAddressForm';
import { SignupReviewIllustration } from '../../illustrations/SignupReviewIllustration';
import { isoToFlagEmoji } from '../../../utils/countryFlagEmoji';
import { ReviewDetailRow, ReviewSummaryCard } from '../ReviewSummaryCard';
import type { WizardStepId } from '../wizard/types';
import type { AgentFocus } from '../../../types/agentFocus';

type PersonaIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Translate = (key: string, fallback: string) => string;

const PERSONA_ICONS: Record<SignupStartPersona, PersonaIcon> = {
  client: 'account-circle-outline',
  agent: 'bike-fast',
  business: 'store-outline',
};

export interface ReviewStepProps {
  personas: SignupStartPersona[];
  agentFocus?: AgentFocus | '';
  businessName: string;
  mainInterest: SignupMainInterest;
  referralAgentCode: string;
  referralLookup: AgentReferralLookupResult | null;
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string | null;
  countryLabel: string;
  countryCode: string;
  storeLocation: DeliveryAddressFormValue;
  onEditStep: (id: WizardStepId) => void;
}

function personaLabel(p: SignupStartPersona, t: Translate, agentFocus?: AgentFocus | ''): string {
  if (p === 'client') return t('persona.clientTitle', 'Client');
  if (p === 'agent' && agentFocus === 'delivery') {
    return t('persona.agentDeliveryTitle', 'Delivery agent');
  }
  if (p === 'agent' && agentFocus === 'commercial') {
    return t('persona.agentCommercialTitle', 'Commercial agent');
  }
  if (p === 'agent') return t('persona.agentTitle', 'Agent');
  return t('persona.businessTitle', 'Business');
}

function businessRoleLine(name: string, interest: SignupMainInterest, t: Translate): string {
  const focus =
    interest === 'rent_items'
      ? t('enrollPersona.business.focusRent', 'Rent & earn')
      : t('enrollPersona.business.focusSell', 'Sell items');
  return `${personaLabel('business', t)} — ${name} (${focus})`;
}

function personasLine(
  personas: SignupStartPersona[],
  businessName: string,
  mainInterest: SignupMainInterest,
  t: Translate,
  agentFocus?: AgentFocus | ''
): string {
  return personas
    .map((p) =>
      p === 'business' ? businessRoleLine(businessName, mainInterest, t) : personaLabel(p, t, agentFocus)
    )
    .join(', ');
}

function RoleCard({
  personas,
  agentFocus,
  businessName,
  mainInterest,
  onEdit,
}: {
  personas: SignupStartPersona[];
  agentFocus?: AgentFocus | '';
  businessName: string;
  mainInterest: SignupMainInterest;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const solo = personas.length === 1 ? personas[0] : null;
  return (
    <ReviewSummaryCard
      title={t('auth.signupFlow.reviewGoal', 'Your role')}
      icon={solo ? PERSONA_ICONS[solo] : 'account-multiple-outline'}
      iconColor={solo ? PERSONA_ACCENT[solo] : undefined}
      delayMs={40}
      onEdit={onEdit}
    >
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {personasLine(personas, businessName, mainInterest, t, agentFocus)}
      </Text>
    </ReviewSummaryCard>
  );
}

function ContactCard({
  firstName,
  lastName,
  email,
  phoneE164,
  referralLabel,
  onEdit,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string | null;
  referralLabel: string | null;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <ReviewSummaryCard
      title={t('auth.signupFlow.reviewContact', 'Contact')}
      icon="card-account-details-outline"
      delayMs={100}
      onEdit={onEdit}
    >
      <ReviewDetailRow icon="account-outline">
        <Text variant="bodyLarge" style={{ color: colors.text.primary }}>
          {firstName.trim()} {lastName.trim()}
        </Text>
      </ReviewDetailRow>
      <ReviewDetailRow icon="email-outline">
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {email.trim()}
        </Text>
      </ReviewDetailRow>
      {phoneE164 ? (
        <ReviewDetailRow icon="phone-outline">
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {phoneE164}
          </Text>
        </ReviewDetailRow>
      ) : null}
      {referralLabel ? (
        <ReviewDetailRow icon="account-heart-outline">
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {referralLabel}
          </Text>
        </ReviewDetailRow>
      ) : null}
    </ReviewSummaryCard>
  );
}

function CountryCard({
  countryLabel,
  countryCode,
  onEdit,
}: {
  countryLabel: string;
  countryCode: string;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <ReviewSummaryCard
      title={t('auth.signupFlow.reviewCountry', 'Country')}
      icon="earth"
      badge={<RNText style={styles.flag}>{isoToFlagEmoji(countryCode)}</RNText>}
      delayMs={160}
      onEdit={onEdit}
    >
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {countryLabel}
      </Text>
    </ReviewSummaryCard>
  );
}

function StoreCard({
  storeLocation,
  onEdit,
}: {
  storeLocation: DeliveryAddressFormValue;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const street = storeLocation.address_line_1.trim();
  const locality = [storeLocation.city, storeLocation.state, storeLocation.postal_code, storeLocation.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
  return (
    <ReviewSummaryCard
      title={t('auth.signupFlow.reviewStoreLocation', 'Store location')}
      icon="map-marker-outline"
      delayMs={220}
      onEdit={onEdit}
    >
      {street ? (
        <Text variant="bodyLarge" style={{ color: colors.text.primary, marginBottom: 2 }}>
          {street}
        </Text>
      ) : null}
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {locality}
      </Text>
    </ReviewSummaryCard>
  );
}

function ReviewHero() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.hero, { marginBottom: spacing.xs }]}>
      <SignupReviewIllustration
        accessibilityLabel={t(
          'auth.signupFlow.reviewIllustrationLabel',
          'Your details are ready to review'
        )}
      />
      <Text variant="labelLarge" style={{ color: colors.success.main, textAlign: 'center' }}>
        {t('auth.signupFlow.reviewAlmostThere', 'Almost there')}
      </Text>
    </View>
  );
}

function referralName(
  personas: SignupStartPersona[],
  code: string,
  lookup: AgentReferralLookupResult | null
): string | null {
  const trimmed = code.trim().toUpperCase();
  const eligible = personas.includes('business') || personas.includes('agent');
  if (!eligible || trimmed.length !== 6 || lookup?.agentCode !== trimmed) return null;
  return lookup.firstName || lookup.fullName;
}

export function ReviewStep({
  personas,
  agentFocus,
  businessName,
  mainInterest,
  referralAgentCode,
  referralLookup,
  firstName,
  lastName,
  email,
  phoneE164,
  countryLabel,
  countryCode,
  storeLocation,
  onEditStep,
}: ReviewStepProps) {
  const { t } = useTranslation();
  const referredBy = referralName(personas, referralAgentCode, referralLookup);
  const referralLabel = referredBy
    ? t('agent.referrals.lookupSuccess', 'Referred by {{name}}', { name: referredBy })
    : null;

  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <ReviewHero />
      <RoleCard
        personas={personas}
        agentFocus={agentFocus}
        businessName={businessName}
        mainInterest={mainInterest}
        onEdit={() => onEditStep('personas')}
      />
      <ContactCard
        firstName={firstName}
        lastName={lastName}
        email={email}
        phoneE164={phoneE164}
        referralLabel={referralLabel}
        onEdit={() => onEditStep('contact')}
      />
      <CountryCard
        countryLabel={countryLabel}
        countryCode={countryCode}
        onEdit={() => onEditStep('country')}
      />
      {personas.includes('business') ? (
        <StoreCard storeLocation={storeLocation} onEdit={() => onEditStep('storeLocation')} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center' },
  flag: { fontSize: 22 },
});
