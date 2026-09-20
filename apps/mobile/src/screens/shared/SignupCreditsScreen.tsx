import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from 'react-native-paper';
import Logo from '../../components/Logo';
import { StoreCreditsIllustration } from '../../components/illustrations/StoreCreditsIllustration';
import { StatusPill } from '../../components/common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { usePurchaseCredits } from '../../hooks/usePurchaseCredits';
import { formatCurrency } from '../../utils/formatters';
import {
  isCampaignPurchaseCredit,
  purchaseCreditScopeLabel,
  purchaseCreditShopTarget,
} from '../../utils/purchaseCredits';
import type { PurchaseCreditGrant } from '../../types/purchaseCredits';

function scopeBody(
  grant: PurchaseCreditGrant,
  t: (key: string, defaultValue: string, options?: Record<string, unknown>) => string
): string {
  if (grant.applicability === 'specific_business') {
    const name =
      grant.business?.name ||
      t('accounts.purchaseCredits.onePartner', 'One partner store');
    return t(
      'auth.signupCredits.bodySpecific',
      'Shop at {{name}} — your credit applies automatically at checkout.',
      { name }
    );
  }
  if (grant.applicability === 'partner_businesses') {
    return t(
      'auth.signupCredits.bodyPartners',
      'Use this credit at any Rendasua partner store. It applies automatically at checkout.'
    );
  }
  return t(
    'auth.signupCredits.bodyAny',
    'Use this credit at any store on Rendasua. It applies automatically at checkout.'
  );
}

function SignupCreditsScreenBase() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { auth } = useStore();
  const { campaignGrants, loading, error, refresh } = usePurchaseCredits(true);
  const [index, setIndex] = useState(0);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    if (loading || error) return undefined;
    if (campaignGrants.length === 0 && !retried) {
      setRetried(true);
      const timer = setTimeout(() => {
        void refresh();
      }, 800);
      return () => clearTimeout(timer);
    }
    if (campaignGrants.length === 0 && retried) {
      auth.dismissSignupCredits();
    }
    return undefined;
  }, [loading, error, campaignGrants.length, retried, refresh, auth]);

  const grants = useMemo(
    () => campaignGrants.filter(isCampaignPurchaseCredit),
    [campaignGrants]
  );
  const grant = grants[index] ?? null;
  const isLast = index >= grants.length - 1;

  const finish = useCallback(
    (shop?: boolean) => {
      if (!grant) {
        auth.dismissSignupCredits();
        return;
      }
      const target = purchaseCreditShopTarget(grant);
      auth.dismissSignupCredits();
      if (!shop) return;
      auth.setPostSignupCreditShop(target);
    },
    [auth, grant]
  );

  const onPrimary = useCallback(() => {
    finish(true);
  }, [finish]);

  const onSecondary = useCallback(() => {
    if (isLast) {
      finish(false);
      return;
    }
    setIndex((i) => i + 1);
  }, [finish, isLast]);

  if (error && !grant) {
    return (
      <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
        <View style={[styles.brand, { paddingTop: insets.top + spacing.sm }]}>
          <Logo variant="compact" />
        </View>
        <View style={[styles.loadingWrap, { paddingHorizontal: spacing.lg, gap: spacing.md }]}>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center' }}>
            {t(
              'auth.signupCredits.loadError',
              'We could not load your welcome credits. Check your connection and try again.'
            )}
          </Text>
          <Button mode="contained" onPress={() => void refresh()}>
            {t('common.retry', 'Retry')}
          </Button>
          <Button mode="text" onPress={() => auth.dismissSignupCredits()}>
            {t('auth.signupCredits.skip', 'Continue to app')}
          </Button>
        </View>
      </View>
    );
  }

  if (!grant) {
    return (
      <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
        <View style={[styles.brand, { paddingTop: insets.top + spacing.sm }]}>
          <Logo variant="compact" />
        </View>
        <View style={styles.loadingWrap}>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {t('auth.signupCredits.loading', 'Checking your welcome credits…')}
          </Text>
        </View>
      </View>
    );
  }

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
        <StoreCreditsIllustration
          size={120}
          accessibilityLabel={t(
            'accounts.purchaseCredits.illustrationLabel',
            'Store credits'
          )}
        />
        <StatusPill
          label={
            grants.length > 1
              ? t('auth.signupCredits.progress', '{{current}} of {{total}}', {
                  current: index + 1,
                  total: grants.length,
                })
              : t('auth.signupCredits.giftPill', 'Welcome gift')
          }
          backgroundColor={colors.successTint}
          textColor={colors.success.dark}
          icon="gift"
          compact
          style={{ alignSelf: 'center' }}
        />
        <Text
          variant="headlineSmall"
          style={[styles.title, { color: colors.text.primary }]}
        >
          {t('auth.signupCredits.title', "You've got store credit!")}
        </Text>
        <Text
          variant="headlineMedium"
          style={{ color: colors.success.main, fontWeight: '800', textAlign: 'center' }}
        >
          {formatCurrency(grant.remaining_amount, grant.currency)}
        </Text>
        {grant.memo ? (
          <Text variant="titleSmall" style={{ color: colors.text.primary, textAlign: 'center' }}>
            {grant.memo}
          </Text>
        ) : null}
        <Text
          variant="bodyMedium"
          style={[styles.body, { color: colors.text.secondary }]}
        >
          {scopeBody(grant, t)}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary, textAlign: 'center' }}>
          {purchaseCreditScopeLabel(grant, t)}
        </Text>
        {grant.expires_at ? (
          <Text variant="labelSmall" style={{ color: colors.warning.dark, textAlign: 'center' }}>
            {t('accounts.purchaseCredits.expires', 'Expires')} {grant.expires_at.slice(0, 10)}
          </Text>
        ) : null}
        <Text variant="bodySmall" style={{ color: colors.text.secondary, textAlign: 'center' }}>
          {t(
            'auth.signupCredits.notWithdrawable',
            'Store credits cannot be withdrawn. They apply automatically when you shop.'
          )}
        </Text>
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
            gap: spacing.sm,
          },
        ]}
      >
        <Button
          mode="contained"
          onPress={onPrimary}
          style={styles.cta}
          contentStyle={styles.ctaContent}
          labelStyle={styles.ctaLabel}
        >
          {grant.applicability === 'specific_business'
            ? t('auth.signupCredits.shopStore', 'Shop this store')
            : grant.applicability === 'partner_businesses'
              ? t('auth.signupCredits.shopPartners', 'Browse partner stores')
              : t('auth.signupCredits.shopAny', 'Start shopping')}
        </Button>
        <Button mode="text" onPress={onSecondary}>
          {isLast
            ? t('auth.signupCredits.skip', 'Continue to app')
            : t('auth.signupCredits.next', 'Next credit')}
        </Button>
      </View>
    </View>
  );
}

export default observer(SignupCreditsScreenBase);

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
  title: { fontWeight: '800', textAlign: 'center' },
  body: { textAlign: 'center' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  footer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  cta: { height: 48, alignSelf: 'stretch' },
  ctaContent: { height: 48 },
  ctaLabel: { marginVertical: 0, fontSize: 16, textAlign: 'center' },
});
