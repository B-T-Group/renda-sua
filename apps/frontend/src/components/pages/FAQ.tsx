import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Container,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

const FAQ: React.FC = () => {
  const { t } = useTranslation();

  const faqs = [
    {
      key: 'client.topup',
      q: t('faq.client.topup.q'),
      a: t('faq.client.topup.a'),
    },
    {
      key: 'agent.hold',
      q: t('faq.agent.hold.q'),
      a: t('faq.agent.hold.a'),
    },
    {
      key: 'agent.verifiedLessHold',
      q: t('faq.agent.verifiedLessHold.q'),
      a: t('faq.agent.verifiedLessHold.a'),
    },
    {
      key: 'business.verification',
      q: t('faq.business.verification.q'),
      a: t('faq.business.verification.a'),
    },
    {
      key: 'settlement.release',
      q: t('faq.settlement.release.q'),
      a: t('faq.settlement.release.a'),
    },
  ];

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('faq.title')}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          {t('faq.subtitle')}
        </Typography>
      </Box>

      <Box>
        {faqs.map((item) => (
          <Accordion key={item.key} sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1" fontWeight={600}>
                {item.q}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body1" color="text.secondary">
                {item.a}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Container>
  );
};

export default FAQ;

