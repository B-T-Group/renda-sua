import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ITEM_DETAIL_FAQ_ANCHORS } from './ItemDetailTrustStrip';

export type ItemDetailFaqAccordionProps = {
  onToggle?: (questionId: string, expanded: boolean) => void;
};

export function ItemDetailFaqAccordion({ onToggle }: ItemDetailFaqAccordionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState<string | false>(false);

  const items = [
    {
      id: 'payment',
      anchor: ITEM_DETAIL_FAQ_ANCHORS.payment,
      q: t('items.detail.faq.paymentQ', 'How do I pay?'),
      a: t(
        'items.detail.faq.paymentA',
        'Pay with MTN MoMo, Orange Money, or other supported mobile money at checkout.'
      ),
    },
    {
      id: 'delivery',
      anchor: ITEM_DETAIL_FAQ_ANCHORS.delivery,
      q: t('items.detail.faq.deliveryQ', 'When will I receive my order?'),
      a: t(
        'items.detail.faq.deliveryA',
        'Delivery is typically within 6–24 hours depending on when you order and local availability.'
      ),
    },
    {
      id: 'issue',
      anchor: ITEM_DETAIL_FAQ_ANCHORS.issue,
      q: t('items.detail.faq.issueQ', 'What if something goes wrong?'),
      a: t(
        'items.detail.faq.issueA',
        'Contact support with your order details. We will help you resolve delivery or product issues.'
      ),
    },
    {
      id: 'seller',
      anchor: ITEM_DETAIL_FAQ_ANCHORS.seller,
      q: t('items.detail.faq.sellerQ', 'Who is selling this item?'),
      a: t(
        'items.detail.faq.sellerA',
        'The store shown under “Fulfilled by” prepares and ships your order. Verified sellers completed extra checks.'
      ),
    },
  ];

  return (
    <Box id="item-detail-faq" sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t('items.detail.faq.title', 'Common questions')}
      </Typography>
      {items.map((row) => (
        <Accordion
          key={row.id}
          disableGutters
          expanded={expanded === row.id}
          onChange={(_, isEx) => {
            const next = isEx ? row.id : false;
            setExpanded(next);
            onToggle?.(row.id, isEx);
          }}
        >
          <AccordionSummary
            id={row.anchor}
            expandIcon={<ExpandMoreIcon />}
            sx={{ minHeight: 48 }}
          >
            <Typography variant="subtitle2" fontWeight={700}>
              {row.q}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              {row.a}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
