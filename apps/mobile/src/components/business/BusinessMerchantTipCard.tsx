import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { ProductPhotoTipsIllustration } from '../illustrations/ProductPhotoTipsIllustration';
import type { ResolvedMerchantTip } from '../../utils/businessStoreReadiness';
import {
  trackNudgeClicked,
  trackNudgeDismissed,
  trackNudgeShown,
} from '../../utils/ftueAnalytics';

type Props = {
  tip: ResolvedMerchantTip;
  onAction: () => void;
  onDismiss: () => void;
};

const TIP_COPY: Record<
  ResolvedMerchantTip['id'],
  { titleKey: string; title: string; messageKey: string; message: string; ctaKey: string; cta: string }
> = {
  first_order_congrats: {
    titleKey: 'business.tips.firstOrderTitle',
    title: 'Your first order!',
    messageKey: 'business.tips.firstOrderMessage',
    message:
      'You are officially selling. Keep the catalog fresh so the next orders come easier.',
    ctaKey: 'business.tips.firstOrderCta',
    cta: 'View orders',
  },
  catalog_10_congrats: {
    titleKey: 'business.tips.catalog10Title',
    title: '10 products — great start!',
    messageKey: 'business.tips.catalog10Message',
    message: 'Your catalog is taking shape. Share your store so more buyers can find you.',
    ctaKey: 'business.tips.catalog10Cta',
    cta: 'Share storefront',
  },
  views_10_congrats: {
    titleKey: 'business.tips.views10Title',
    title: 'Nice — 10 store views!',
    messageKey: 'business.tips.views10Message',
    message:
      'Shoppers are discovering you. Add more products so they have more to choose from.',
    ctaKey: 'business.tips.views10Cta',
    cta: 'Add a product',
  },
  rejected_item: {
    titleKey: 'business.tips.rejectedTitle',
    title: 'Tip: fix a rejected product',
    messageKey: 'business.tips.rejectedMessage',
    message:
      'One or more products were rejected. Update them and resubmit so they can go live.',
    ctaKey: 'business.tips.rejectedCta',
    cta: 'Review items',
  },
  restock_top_viewed: {
    titleKey: 'business.tips.restockTitle',
    title: 'Tip: restock a popular item',
    messageKey: 'business.tips.restockMessage',
    message:
      'Buyers are viewing an item that is out of stock. Restock it while interest is high.',
    ctaKey: 'business.tips.restockCta',
    cta: 'Manage inventory',
  },
  catalog_goal: {
    titleKey: 'business.tips.catalogGoalTitle',
    title: 'Tip: reach your first 10 products',
    messageKey: 'business.tips.catalogGoalMessage',
    message:
      'Stores with a fuller catalog get more discovery. Add {{remaining}} more to hit 10.',
    ctaKey: 'business.tips.catalogGoalCta',
    cta: 'Add a product',
  },
  catalog_variety: {
    titleKey: 'business.tips.varietyTitle',
    title: 'Tip: give buyers more variety',
    messageKey: 'business.tips.varietyMessage',
    message:
      'You have attention — expand the catalog so browsers convert into orders.',
    ctaKey: 'business.tips.varietyCta',
    cta: 'Add a product',
  },
  share_store: {
    titleKey: 'business.tips.shareTitle',
    title: 'Tip: share your storefront',
    messageKey: 'business.tips.shareMessage',
    message:
      'Share your shop link so customers outside the app can browse and order.',
    ctaKey: 'business.tips.shareCta',
    cta: 'Share store',
  },
  ai_photos_pending: {
    titleKey: 'business.tips.aiPendingTitle',
    title: 'Tip: clean up product photos',
    messageKey: 'business.tips.aiPendingMessage',
    message:
      'Some product photos still look better with AI cleanup. Use your tokens before publishing more.',
    ctaKey: 'business.tips.aiPendingCta',
    cta: 'Clean up photos',
  },
  ai_tokens_empty: {
    titleKey: 'business.tips.tokensEmptyTitle',
    title: 'Tip: get more AI tokens',
    messageKey: 'business.tips.tokensEmptyMessage',
    message:
      'You are out of AI tokens and still have photos that could use cleanup.',
    ctaKey: 'business.tips.tokensEmptyCta',
    cta: 'Buy AI tokens',
  },
  pending_moderation: {
    titleKey: 'business.tips.pendingTitle',
    title: 'Tip: items under review',
    messageKey: 'business.tips.pendingMessage',
    message:
      '{{count}} item(s) are waiting for approval. We will notify you when they are live.',
    ctaKey: 'business.tips.pendingCta',
    cta: 'View items',
  },
  logo: {
    titleKey: 'business.tips.logoTitle',
    title: 'Tip: add your business logo',
    messageKey: 'business.tips.logoMessage',
    message:
      'A logo helps buyers recognize your store in search and on your storefront.',
    ctaKey: 'business.tips.logoCta',
    cta: 'Add logo',
  },
  hours: {
    titleKey: 'business.tips.hoursTitle',
    title: 'Tip: set your business hours',
    messageKey: 'business.tips.hoursMessage',
    message:
      'Hours tell customers when you are open and improve delivery-slot matching.',
    ctaKey: 'business.tips.hoursCta',
    cta: 'Set hours',
  },
  preview_store: {
    titleKey: 'business.tips.previewTitle',
    title: 'Tip: preview your storefront',
    messageKey: 'business.tips.previewMessage',
    message: 'See your shop the way buyers do before they place an order.',
    ctaKey: 'business.tips.previewCta',
    cta: 'Preview store',
  },
  ai_photos: {
    titleKey: 'ftue.education.merchantTipTitle',
    title: 'Tip: better product photos',
    messageKey: 'ftue.education.merchantTipMessage',
    message: 'Use your free AI tokens to clean up photos before publishing.',
    ctaKey: 'business.tips.aiPhotosCta',
    cta: 'Open AI tokens',
  },
  insights: {
    titleKey: 'business.tips.insightsTitle',
    title: 'Tip: check what buyers view',
    messageKey: 'business.tips.insightsMessage',
    message:
      'Product views show which items attract attention — double down on those.',
    ctaKey: 'business.tips.insightsCta',
    cta: 'Open insights',
  },
};

export function BusinessMerchantTipCard({ tip, onAction, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const tracked = useRef(false);
  const copy = TIP_COPY[tip.id];
  const nudgeKey = `merchant-tip:${tip.id}`;

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackNudgeShown(nudgeKey);
  }, [nudgeKey]);

  const showPhotoArt =
    tip.id === 'ai_photos' ||
    tip.id === 'ai_photos_pending' ||
    tip.id === 'ai_tokens_empty';

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor:
            tip.kind === 'celebration' ? colors.success.main : colors.divider,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      {showPhotoArt ? (
        <View style={styles.art}>
          <ProductPhotoTipsIllustration />
        </View>
      ) : null}
      <Text
        variant="titleSmall"
        style={{ color: colors.text.primary, fontWeight: '700' }}
      >
        {t(copy.titleKey, copy.title)}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {t(copy.messageKey, copy.message, {
          remaining: tip.remainingToCatalog ?? 0,
          count: tip.pendingCount ?? 0,
        })}
      </Text>
      <View style={[styles.actions, { gap: spacing.sm }]}>
        <Button
          mode="text"
          onPress={() => {
            trackNudgeDismissed(nudgeKey);
            onDismiss();
          }}
        >
          {t('ftue.nudges.dismiss', 'Not now')}
        </Button>
        <Button
          mode="contained"
          onPress={() => {
            trackNudgeClicked(nudgeKey);
            onAction();
          }}
        >
          {t(copy.ctaKey, copy.cta)}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  art: { alignItems: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap' },
});
