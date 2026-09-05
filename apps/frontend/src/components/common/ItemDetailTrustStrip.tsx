import { Box, Chip, Stack } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const ITEM_DETAIL_FAQ_ANCHORS = {
  payment: 'item-detail-faq-payment',
  delivery: 'item-detail-faq-delivery',
  issue: 'item-detail-faq-issue',
  seller: 'item-detail-faq-seller',
} as const;

export type ItemDetailTrustStripProps = {
  isVerifiedSeller: boolean;
  /** When true, the client pays by card (Stripe rail) instead of mobile money. */
  isStripeRail?: boolean;
};

function scrollToAnchor(anchorId: string) {
  document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function ItemDetailTrustStrip({
  isVerifiedSeller,
  isStripeRail = false,
}: ItemDetailTrustStripProps) {
  const { t } = useTranslation();
  const chipSx = { minHeight: 36, flexShrink: 0, fontWeight: 600 };

  return (
    <Box
      sx={{
        width: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        pb: 0.25,
        scrollSnapType: 'x proximity',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ width: 'max-content', pr: 1 }}>
        <Chip
          sx={{ ...chipSx, scrollSnapAlign: 'start' }}
          label={
            isStripeRail
              ? t('items.detail.trustStrip.cardSecure', 'Card secure')
              : t('items.detail.trustStrip.mobileMoney', 'MoMo secure')
          }
          variant="outlined"
          onClick={() => scrollToAnchor(ITEM_DETAIL_FAQ_ANCHORS.payment)}
        />
        {isVerifiedSeller ? (
          <Chip
            sx={chipSx}
            label={t('items.detail.trustStrip.verified', 'Verified seller')}
            variant="outlined"
            onClick={() => scrollToAnchor(ITEM_DETAIL_FAQ_ANCHORS.seller)}
          />
        ) : null}
        <Chip
          sx={chipSx}
          label={t('items.detail.trustStrip.support', 'Help if something goes wrong')}
          variant="outlined"
          onClick={() => scrollToAnchor(ITEM_DETAIL_FAQ_ANCHORS.issue)}
        />
      </Stack>
    </Box>
  );
}
