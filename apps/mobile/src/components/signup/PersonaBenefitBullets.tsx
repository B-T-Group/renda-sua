import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import {
  SIGNUP_BENEFIT_BULLET_KEYS,
  type SignupBenefitPersona,
} from '../../constants/signupBenefits';

const HEADLINE_DEFAULTS: Record<SignupBenefitPersona, string> = {
  client: 'Shop local, track every order',
  agent: 'Deliver on your schedule, get paid per trip',
  business: 'Open your storefront and start selling',
};

const BULLET_DEFAULTS: Record<SignupBenefitPersona, Record<string, string>> = {
  client: {
    b1: 'Browse and buy from nearby stores in one place',
    b2: 'Track delivery in real time and chat with your agent',
    b3: 'Save addresses and reorder faster next time',
  },
  agent: {
    b1: 'Claim nearby delivery runs when it suits you',
    b2: 'Navigate pickups and drop-offs with in-app guidance',
    b3: 'Get paid per completed delivery',
  },
  business: {
    b1: 'List products with photos and AI-assisted details',
    b2: 'Manage orders, inventory, and locations in one dashboard',
    b3: 'Reach local buyers; we handle delivery coordination',
  },
};

export interface PersonaBenefitBulletsProps {
  persona: SignupBenefitPersona;
  compact?: boolean;
}

export function PersonaBenefitBullets({
  persona,
  compact = false,
}: PersonaBenefitBulletsProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <Text
        variant={compact ? 'labelMedium' : 'bodySmall'}
        style={styles.headline}
      >
        {t(
          `signup.benefits.${persona}.headline`,
          HEADLINE_DEFAULTS[persona]
        )}
      </Text>
      {SIGNUP_BENEFIT_BULLET_KEYS.map((key) => (
        <Text
          key={key}
          variant="labelSmall"
          style={[styles.bullet, compact && styles.bulletCompact]}
        >
          {`• ${t(
            `signup.benefits.${persona}.${key}`,
            BULLET_DEFAULTS[persona][key]
          )}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  headline: { fontWeight: '700', marginBottom: 4 },
  bullet: { opacity: 0.85, lineHeight: 18 },
  bulletCompact: { fontSize: 11, lineHeight: 16 },
});
