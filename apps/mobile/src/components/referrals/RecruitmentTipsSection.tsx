import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import {
  RecruitmentApproachVector,
  RecruitmentBenefitsVector,
  RecruitmentPitchVector,
} from '@/components/illustrations/RecruitmentTipsVectors';

function TipCard({
  title,
  body,
  illustration,
}: {
  title: string;
  body: string;
  illustration: React.ReactNode;
}) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      {illustration}
      <Text
        variant="titleSmall"
        style={{
          color: colors.text.primary,
          fontWeight: '700',
          marginTop: spacing.sm,
        }}
      >
        {title}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginTop: 6 }}
      >
        {body}
      </Text>
    </View>
  );
}

export function RecruitmentTipsSection() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text
        variant="titleMedium"
        style={{
          color: colors.text.primary,
          fontWeight: '700',
          marginBottom: spacing.sm,
        }}
      >
        {t('agent.businessReferrals.tips.sectionTitle', 'Tips for recruiting')}
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginBottom: spacing.md }}
      >
        {t(
          'agent.businessReferrals.tips.sectionIntro',
          'Use these talking points when you meet shop owners who are not on Rendasua yet.'
        )}
      </Text>

      <TipCard
        title={t(
          'agent.businessReferrals.tips.approachTitle',
          'How to approach'
        )}
        body={t(
          'agent.businessReferrals.tips.approachBody',
          'Visit during a quiet hour. Introduce yourself as a local Rendasua partner, ask how they currently sell and deliver, then offer to show how the app brings them new customers without extra staff.'
        )}
        illustration={<RecruitmentApproachVector />}
      />

      <TipCard
        title={t(
          'agent.businessReferrals.tips.benefitsTitle',
          'Benefits to highlight'
        )}
        body={t(
          'agent.businessReferrals.tips.benefitsBody',
          'Free online listing, more local customers, delivery handled for them, and payouts after sales. They stay in control of prices and inventory while Rendasua brings the demand.'
        )}
        illustration={<RecruitmentBenefitsVector />}
      />

      <TipCard
        title={t(
          'agent.businessReferrals.tips.pitchTitle',
          'What to tell them'
        )}
        body={t(
          'agent.businessReferrals.tips.pitchBody',
          '“I help shops join Rendasua so nearby customers can order from you. Signing up is free — use my code {{codePlaceholder}} so I can support your setup: products, payments, and first orders.” Share your real code when you speak with them.',
          { codePlaceholder: '______' }
        )}
        illustration={<RecruitmentPitchVector />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    alignItems: 'center',
  },
});
