import { ExpandMore } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SectionShell from './SectionShell';

const FAQ_KEYS = [
  'cost',
  'payouts',
  'momo',
  'delivery',
  'speed',
  'stores',
  'employees',
  'ai',
] as const;

const FAQ_DEFAULTS: Record<(typeof FAQ_KEYS)[number], { q: string; a: string }> = {
  cost: {
    q: 'How much does it cost?',
    a: 'There is no subscription. You start free on Standard and only pay a commission when you make a sale.',
  },
  payouts: {
    q: 'How do I receive payments?',
    a: 'Customer payments are processed securely and settled to you according to your payout method and plan.',
  },
  momo: {
    q: 'Can I use Mobile Money?',
    a: 'Yes. Mobile Money is supported in markets where it is available so customers can pay the way they already do.',
  },
  delivery: {
    q: 'How does delivery work?',
    a: 'When an order is ready, a Rendasua delivery agent can pick up from your location and deliver to the customer.',
  },
  speed: {
    q: 'How quickly can I start selling?',
    a: 'Most merchants create an account, add products, and go live in under 5 minutes.',
  },
  stores: {
    q: 'Can I manage multiple stores?',
    a: 'Yes. You can manage inventory across multiple business locations from one account.',
  },
  employees: {
    q: 'Can multiple employees use the account?',
    a: 'You can collaborate from a shared business account. Ask support about team access options for your plan.',
  },
  ai: {
    q: 'How does AI help me?',
    a: 'AI can clean product photos and generate descriptions so listings look professional with less effort.',
  },
};

const FAQ: React.FC = () => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<string | false>(false);

  return (
    <SectionShell
      id="faq"
      title={t('forBusiness.faq.title', 'Frequently asked questions')}
      subtitle={t(
        'forBusiness.faq.subtitle',
        'Straight answers before you create your store.'
      )}
      maxWidth="md"
    >
      {FAQ_KEYS.map((key, i) => {
        const panel = `forBusiness.faq.${key}`;
        return (
          <Accordion
            key={key}
            expanded={expanded === panel}
            onChange={(_, open) => setExpanded(open ? panel : false)}
            elevation={0}
            disableGutters
            sx={{
              border: '1.5px solid',
              borderColor: expanded === panel ? 'primary.main' : 'divider',
              borderRadius: '12px !important',
              mb: 1.5,
              '&:before': { display: 'none' },
              overflow: 'hidden',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              aria-controls={`fb-faq-${i}-content`}
              id={`fb-faq-${i}-header`}
              sx={{ px: 3, py: 1.5 }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t(`forBusiness.faq.${key}.q`, FAQ_DEFAULTS[key].q)}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 3, pb: 2.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                {t(`forBusiness.faq.${key}.a`, FAQ_DEFAULTS[key].a)}
              </Typography>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </SectionShell>
  );
};

export default FAQ;
