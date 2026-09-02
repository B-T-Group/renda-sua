import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { QuietHomeNextAction } from '../../utils/resolveQuietHomeNextAction';

type Props = {
  action: QuietHomeNextAction;
  onAction: () => void;
};

const COPY: Record<
  QuietHomeNextAction['id'],
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
  fix_rejected: {
    titleKey: 'business.tips.rejectedTitle',
    title: 'Tip: fix a rejected product',
    messageKey: 'business.tips.rejectedMessage',
    message:
      'One or more products were rejected. Update them and resubmit so they can go live.',
    ctaKey: 'business.tips.rejectedCta',
    cta: 'Review items',
  },
  restock: {
    titleKey: 'business.tips.restockTitle',
    title: 'Tip: restock a popular item',
    messageKey: 'business.tips.restockMessage',
    message:
      'Buyers are viewing an item that is out of stock. Restock it while interest is high.',
    ctaKey: 'business.tips.restockCta',
    cta: 'Manage inventory',
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
  catalog_goal: {
    titleKey: 'business.tips.catalogGoalTitle',
    title: 'Tip: reach your first 10 products',
    messageKey: 'business.tips.catalogGoalMessage',
    message:
      'Stores with a fuller catalog get more discovery. Add {{remaining}} more to hit 10.',
    ctaKey: 'business.tips.catalogGoalCta',
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
};

export function BusinessQuietHomeNextActionCard({ action, onAction }: Props) {
  const { t } = useTranslation();
  const copy = COPY[action.id];
  if (!copy) return null;

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: action.kind === 'blocker' ? 'warning.main' : 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {t('business.quietHome.next.label', 'Next step')}
      </Typography>
      <Typography variant="subtitle1" fontWeight={700}>
        {t(copy.titleKey, copy.title)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t(copy.messageKey, copy.message, {
          remaining: action.remainingToCatalog ?? 0,
          count: action.pendingCount ?? 0,
        })}
      </Typography>
      <Button variant="contained" onClick={onAction}>
        {t(copy.ctaKey, copy.cta)}
      </Button>
    </Box>
  );
}

export default BusinessQuietHomeNextActionCard;
