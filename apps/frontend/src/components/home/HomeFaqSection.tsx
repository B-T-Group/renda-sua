import { ExpandMore } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Container, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { homeFaqItems } from './data/homeFaqData';

const HomeFaqSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box
      component="section"
      id="faq"
      sx={{ py: { xs: 8, md: 14 }, bgcolor: 'background.default' }}
    >
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Typography
              component="h2"
              sx={{
                fontSize: { xs: '2rem', md: '2.5rem' },
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                color: 'text.primary',
                mb: 2,
              }}
            >
              {t('home.faq.title', 'Frequently asked questions')}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {t('home.faq.subtitle', 'Everything you need to know to get started.')}
            </Typography>
          </motion.div>
        </Box>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {homeFaqItems.map((item, i) => (
            <Accordion
              key={item.questionKey}
              expanded={expanded === item.questionKey}
              onChange={handleChange(item.questionKey)}
              elevation={0}
              disableGutters
              sx={{
                border: '1.5px solid',
                borderColor: expanded === item.questionKey ? 'primary.main' : 'divider',
                borderRadius: '12px !important',
                mb: 1.5,
                '&:before': { display: 'none' },
                overflow: 'hidden',
                transition: 'border-color 0.2s ease',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore />}
                aria-controls={`faq-${i}-content`}
                id={`faq-${i}-header`}
                sx={{ px: 3, py: 1.5, '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t(item.questionKey, item.defaultQuestion)}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 2.5 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.75 }}>
                  {t(item.answerKey, item.defaultAnswer)}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </motion.div>

        <Box sx={{ textAlign: 'center', mt: 5 }}>
          <Button
            component={RouterLink}
            to="/faq"
            variant="outlined"
            sx={{ fontWeight: 600, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
          >
            {t('home.faq.seeAll', 'See all FAQs')}
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default HomeFaqSection;
