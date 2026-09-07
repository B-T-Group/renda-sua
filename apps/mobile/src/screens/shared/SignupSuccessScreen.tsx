import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from 'react-native-paper';
import Logo from '../../components/Logo';
import { SignupSuccessIllustration } from '../../components/illustrations/SignupSuccessIllustration';
import { StatusPill } from '../../components/common/StatusPill';
import { AgentSignupQuickTips } from '../../components/signup/AgentSignupQuickTips';
import {
  SignupWelcomeNextSteps,
  type WelcomeNextStep,
} from '../../components/signup/SignupWelcomeNextSteps';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';

type WelcomePersona = 'client' | 'agent' | 'business';

function personaBody(persona: WelcomePersona, t: TFunction): string {
  const defaults: Record<WelcomePersona, string> = {
    client: 'Your account is ready. Browse local stores and place your first order.',
    agent: 'Your account is ready. Complete payout setup, then claim nearby delivery runs.',
    business: 'Your account is ready. Finish store setup to start accepting orders.',
  };
  return t(`auth.signupWelcome.body.${persona}`, defaults[persona]);
}

function personaCta(persona: WelcomePersona, t: TFunction): string {
  const defaults: Record<WelcomePersona, string> = {
    client: 'Browse items',
    agent: 'See available runs',
    business: 'Set up my store',
  };
  return t(`auth.signupWelcome.cta.${persona}`, defaults[persona]);
}

function nextStepsFor(persona: WelcomePersona, t: TFunction): WelcomeNextStep[] {
  const upcoming: Record<WelcomePersona, [string, string]> = {
    client: [
      t('auth.signupWelcome.next.clientBrowse', 'Browse nearby stores'),
      t('auth.signupWelcome.next.clientOrder', 'Place your first order'),
    ],
    agent: [
      t('auth.signupWelcome.next.agentPayout', 'Set up payouts'),
      t('auth.signupWelcome.next.agentClaim', 'Claim a nearby delivery'),
    ],
    business: [
      t('auth.signupWelcome.next.businessSetup', 'Finish store setup'),
      t('auth.signupWelcome.next.businessCatalog', 'Add products and go live'),
    ],
  };
  return [
    { label: t('auth.signupWelcome.stepDone', 'Account created'), done: true },
    { label: upcoming[persona][0] },
    { label: upcoming[persona][1] },
  ];
}

function welcomeCopy(
  t: TFunction,
  showLaunchPromo: boolean,
  persona: WelcomePersona,
  promo: { businessLimit?: number | null; zeroCommissionOrders?: number | null; identificationWindowDays?: number | null } | null
): { title: string; body: string } {
  if (!showLaunchPromo) {
    return {
      title: t('auth.signupWelcome.title', "You're in!"),
      body: personaBody(persona, t),
    };
  }
  return {
    title: t('business.launchPromo.congratsTitle', {
      defaultValue: "You're one of our first {{limit}} businesses!",
      limit: promo?.businessLimit ?? 150,
    }),
    body: t('business.launchPromo.congratsBody', {
      defaultValue:
        'As part of our launch, you get 0% commission on your first {{orders}} orders. Complete identification within {{days}} days to keep this benefit.',
      orders: promo?.zeroCommissionOrders ?? 15,
      days: promo?.identificationWindowDays ?? 30,
    }),
  };
}

function WelcomeHero({
  persona,
  showLaunchPromo,
  title,
  body,
}: {
  persona: WelcomePersona;
  showLaunchPromo: boolean;
  title: string;
  body: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.hero, { gap: spacing.md }]}>
      <SignupSuccessIllustration
        persona={persona}
        promo={showLaunchPromo}
        accessibilityLabel={t(
          'auth.signupWelcome.illustrationLabel',
          'Your account is ready'
        )}
      />
      <StatusPill
        label={t('auth.signupWelcome.progressPill', 'Account created')}
        backgroundColor={colors.successTint}
        textColor={colors.success.dark}
        icon="check-circle"
        compact
        style={{ alignSelf: 'center' }}
      />
      <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
        {title}
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.body, { color: colors.text.secondary, paddingHorizontal: spacing.xs }]}
      >
        {body}
      </Text>
    </View>
  );
}

function SignupSuccessScreenBase() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { auth } = useStore();
  const persona = auth.signupWelcomePersona ?? 'client';
  const promo = auth.signupLaunchPromo;
  const showLaunchPromo = Boolean(promo);
  const steps = useMemo(() => nextStepsFor(persona, t), [persona, t]);
  const { title, body } = welcomeCopy(t, showLaunchPromo, persona, promo);

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      <View style={[styles.brand, { paddingTop: insets.top + spacing.sm }]}>
        <Logo variant="compact" />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <WelcomeHero
          persona={persona}
          showLaunchPromo={showLaunchPromo}
          title={title}
          body={body}
        />
        <SignupWelcomeNextSteps steps={steps} />
        {showLaunchPromo ? (
          <Text variant="bodySmall" style={[styles.nudge, { color: colors.text.secondary }]}>
            {t(
              'business.launchPromo.referralNudge',
              'Tip: share your business referral code with other merchants — when they get identified and add approved items, you can earn a cash bonus on the side.'
            )}
          </Text>
        ) : null}
        {persona === 'agent' ? <AgentSignupQuickTips /> : null}
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
          },
        ]}
      >
        <Button
          mode="contained"
          onPress={() => auth.dismissSignupWelcome()}
          style={styles.cta}
          contentStyle={styles.ctaContent}
          labelStyle={styles.ctaLabel}
        >
          {personaCta(persona, t)}
        </Button>
      </View>
    </View>
  );
}

export default observer(SignupSuccessScreenBase);

const styles = StyleSheet.create({
  container: { flex: 1 },
  brand: { alignItems: 'center' },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { width: '100%', alignItems: 'center' },
  title: { fontWeight: '800', textAlign: 'center' },
  body: { textAlign: 'center' },
  nudge: { textAlign: 'center' },
  footer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  // height (not minHeight) so Paper's iOS inner layer fills and centers the label.
  cta: { height: 48, alignSelf: 'stretch' },
  ctaContent: { height: 48 },
  ctaLabel: { marginVertical: 0, fontSize: 16, textAlign: 'center' },
});
