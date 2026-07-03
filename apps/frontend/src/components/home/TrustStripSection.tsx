import { Apple, GetApp, Schedule, Security, Store } from '@mui/icons-material';
import { Box, Container, Divider, Stack, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';

const trustItems = [
  { iconKey: 'schedule', defaultText: 'Fast local delivery' },
  { iconKey: 'secure', defaultText: 'Secure payments' },
  { iconKey: 'verified', defaultText: 'Verified businesses' },
  { iconKey: 'apple', defaultText: 'Available on iOS' },
  { iconKey: 'android', defaultText: 'Available on Android' },
] as const;

const TrustIcon: React.FC<{ iconKey: typeof trustItems[number]['iconKey'] }> = ({ iconKey }) => {
  const sx = { fontSize: 18, color: 'primary.main' };
  switch (iconKey) {
    case 'schedule': return <Schedule sx={sx} />;
    case 'secure': return <Security sx={sx} />;
    case 'verified': return <Store sx={sx} />;
    case 'apple': return <Apple sx={sx} />;
    case 'android': return <GetApp sx={sx} />;
  }
};

const TrustStripSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  const translationKeys = [
    { key: 'home.trust.fastDelivery', defaultText: 'Fast local delivery' },
    { key: 'home.trust.securePayments', defaultText: 'Secure payments' },
    { key: 'home.trust.verifiedBusinesses', defaultText: 'Verified businesses' },
    { key: 'home.trust.availableIos', defaultText: 'Available on iOS' },
    { key: 'home.trust.availableAndroid', defaultText: 'Available on Android' },
  ];

  return (
    <Box
      component="section"
      sx={{
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        py: { xs: 2.5, md: 3 },
      }}
    >
      <Container maxWidth="xl">
        <Stack
          direction="row"
          divider={<Divider orientation="vertical" flexItem />}
          spacing={0}
          justifyContent="space-around"
          alignItems="center"
          flexWrap="wrap"
          sx={{ gap: { xs: 2, sm: 0 } }}
        >
          {trustItems.map((item, i) => (
            <motion.div
              key={item.iconKey}
              initial={{ opacity: 0, y: shouldReduce ? 0 : 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ px: { xs: 1.5, md: 3 }, py: { xs: 0.5, md: 0 } }}
              >
                <TrustIcon iconKey={item.iconKey} />
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap', fontSize: { xs: '0.8rem', md: '0.875rem' } }}
                >
                  {t(translationKeys[i].key, translationKeys[i].defaultText)}
                </Typography>
              </Stack>
            </motion.div>
          ))}
        </Stack>
      </Container>
    </Box>
  );
};

export default TrustStripSection;
