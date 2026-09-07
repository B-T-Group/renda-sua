import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { QuietHomeNextAction } from '../../utils/resolveQuietHomeNextAction';
import {
  trackNudgeClicked,
  trackNudgeDismissed,
  trackNudgeShown,
} from '../../utils/ftueAnalytics';
import { ProductPhotoTipsIllustration } from '../illustrations/ProductPhotoTipsIllustration';

type Props = {
  action: QuietHomeNextAction;
  onAction: () => void;
  onDismiss?: () => void;
};

const TIP_COPY: Record<
  string,
  {
    titleKey: string;
    title: string;
    messageKey: string;
    message: string;
    ctaKey: string;
    cta: string;
  }
> = {
  cannot_accept_orders: {
    titleKey: 'business.quietHome.next.cannotAcceptTitle',
    title: 'Finish setup to accept orders',
    messageKey: 'business.quietHome.next.cannotAcceptMessage',
    message:
      'Your store is not yet able to accept orders. Complete the remaining verification steps.',
    ctaKey: 'business.quietHome.next.cannotAcceptCta',
    cta: 'Continue setup',
  },
  setup_stripe_connect: {
    titleKey: 'business.quietHome.next.setupStripeTitle',
    title: 'Set up payouts',
    messageKey: 'business.quietHome.next.setupStripeMessage',
    message:
      'Connect Stripe so you can receive payouts from card orders.',
    ctaKey: 'business.quietHome.next.setupStripeCta',
    cta: 'Configure payments',
  },
  id_review: {
    titleKey: 'business.quietHome.next.idReviewTitle',
    title: 'ID under review',
    messageKey: 'business.quietHome.next.idReviewMessage',
    message:
      'We are reviewing your ID. You can check status or upload a clearer document.',
    ctaKey: 'business.quietHome.next.idReviewCta',
    cta: 'View ID status',
  },
  confirm_mm_phone: {
    titleKey: 'business.quietHome.next.mmPhoneTitle',
    title: 'Confirm mobile money number',
    messageKey: 'business.quietHome.next.mmPhoneMessage',
    message:
      'Link a verified mobile money number so payouts reach you when orders come in.',
    ctaKey: 'business.quietHome.next.mmPhoneCta',
    cta: 'Confirm number',
  },
  actions_needed: {
    titleKey: 'business.quietHome.next.actionsTitle',
    title: 'Actions needed',
    messageKey: 'business.quietHome.next.actionsMessage',
    message: 'You have {{count}} item(s) waiting for your decision.',
    ctaKey: 'business.quietHome.next.actionsCta',
    cta: 'Review now',
  },
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
  offer_rentals: {
    titleKey: 'business.quietHome.next.offerRentalsTitle',
    title: 'Also offer rentals?',
    messageKey: 'business.quietHome.next.offerRentalsMessage',
    message:
      'You can add rental items anytime — they live alongside your sale catalog.',
    ctaKey: 'business.quietHome.next.offerRentalsCta',
    cta: 'Open rentals',
  },
  offer_sale_items: {
    titleKey: 'business.quietHome.next.offerSaleItemsTitle',
    title: 'Also sell products?',
    messageKey: 'business.quietHome.next.offerSaleItemsMessage',
    message:
      'You can add sale items anytime — they live alongside your rental catalog.',
    ctaKey: 'business.quietHome.next.offerSaleItemsCta',
    cta: 'Open items',
  },
};

export function BusinessQuietHomeNextActionCard({
  action,
  onAction,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const trackedKey = useRef<string | null>(null);
  const copy = TIP_COPY[action.id];
  const isTipLike =
    action.kind === 'tip' || action.kind === 'celebration';
  const nudgeKey = isTipLike ? `merchant-tip:${action.id}` : `quiet-next:${action.id}`;

  useEffect(() => {
    if (trackedKey.current === nudgeKey) return;
    trackedKey.current = nudgeKey;
    trackNudgeShown(nudgeKey);
  }, [nudgeKey]);

  if (!copy) return null;

  const showPhotoArt =
    action.id === 'ai_photos' ||
    action.id === 'ai_photos_pending' ||
    action.id === 'ai_tokens_empty';

  const title = t(copy.titleKey, copy.title);
  const message = t(copy.messageKey, copy.message, {
    remaining: action.remainingToCatalog ?? 0,
    count: action.pendingCount ?? action.actionsCount ?? 0,
  });
  const cta = t(copy.ctaKey, copy.cta);

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor:
            action.kind === 'celebration' || action.kind === 'blocker'
              ? action.kind === 'celebration'
                ? colors.success.main
                : colors.warning.main
              : colors.divider,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
        {t('business.quietHome.next.label', 'Next step')}
      </Text>
      {showPhotoArt ? <ProductPhotoTipsIllustration /> : null}
      <Text
        variant="titleMedium"
        style={{ color: colors.text.primary, fontWeight: '700' }}
      >
        {title}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {message}
      </Text>
      <Button
        mode="contained"
        onPress={() => {
          trackNudgeClicked(nudgeKey);
          onAction();
        }}
      >
        {cta}
      </Button>
      {onDismiss && isTipLike ? (
        <Button
          mode="text"
          onPress={() => {
            trackNudgeDismissed(nudgeKey);
            onDismiss();
          }}
        >
          {t('common.dismiss', 'Dismiss')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
});
