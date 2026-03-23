import {
  AccountBalanceWallet as PayoutIcon,
  CheckCircle as CheckCircleIcon,
  DescriptionOutlined as ContractIcon,
  RateReview as RateReviewIcon,
  VpnKey as PinIcon,
} from '@mui/icons-material';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../seo/SEOHead';

interface InfoBlockProps {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const InfoBlock: React.FC<InfoBlockProps> = ({ icon, title, body }) => (
  <Stack direction="row" spacing={2} alignItems="flex-start">
    <Box sx={{ color: 'primary.main', mt: 0.2, '& .MuiSvgIcon-root': { fontSize: 26 } }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="subtitle1" fontWeight={700} component="h2">
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 0.75, lineHeight: 1.65 }}
      >
        {body}
      </Typography>
    </Box>
  </Stack>
);

const RentalRequestSubmittedPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const pageTitle = t('rentals.requestSubmitted.pageTitle', 'Request sent');

  return (
    <>
      <SEOHead
        title={`${pageTitle} | Rendasua`}
        description={t(
          'rentals.requestSubmitted.metaDescription',
          'Your rental request was submitted. Learn what happens next: contract, payment, PIN, and payouts.'
        )}
        noindex
      />
      <Box
        sx={{
          minHeight: '100%',
          pb: {
            xs: 'calc(88px + env(safe-area-inset-bottom, 0px))',
            md: 6,
          },
          pt: { xs: 2, sm: 3 },
          bgcolor: alpha(theme.palette.divider, 0.04),
        }}
      >
        <Container maxWidth="sm" sx={{ px: { xs: 2, sm: 3 } }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 3.5 },
              borderRadius: 3,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Stack spacing={3}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                <Typography variant="h5" fontWeight={800} component="h1">
                  {t('rentals.requestSubmitted.headline', 'Your rental request was submitted')}
                </Typography>
              </Stack>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                {t(
                  'rentals.requestSubmitted.intro',
                  'Here is what happens next on Rendasua.'
                )}
              </Typography>
              <Stack
                spacing={2.5}
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  border: 1,
                  borderColor: alpha(theme.palette.primary.main, 0.12),
                }}
              >
                <InfoBlock
                  icon={<ContractIcon />}
                  title={t('rentals.requestSubmitted.contractTitle', 'Contract and payment')}
                  body={t(
                    'rentals.requestSubmitted.contractBody',
                    'The owner will review your request and, if the item is available for the dates you chose, propose a contract. You can reject that offer or accept it and continue to rental payment.'
                  )}
                />
                <InfoBlock
                  icon={<PinIcon />}
                  title={t('rentals.requestSubmitted.pinTitle', 'Starting the rental')}
                  body={t(
                    'rentals.requestSubmitted.pinBody',
                    'When you meet the owner to begin the rental, you will need to give them your start PIN so they can confirm the handover in the app.'
                  )}
                />
                <InfoBlock
                  icon={<PayoutIcon />}
                  title={t('rentals.requestSubmitted.payoutTitle', 'Funds to the owner')}
                  body={t(
                    'rentals.requestSubmitted.payoutBody',
                    'Payment is released to the owner automatically once the end of the rental period is reached, according to your booking terms.'
                  )}
                />
                <InfoBlock
                  icon={<RateReviewIcon />}
                  title={t('rentals.requestSubmitted.ratingsTitle', 'After the rental ends')}
                  body={t(
                    'rentals.requestSubmitted.ratingsBody',
                    'You will be able to rate the owner, they can rate you, and both of you can rate the rented item—so the community stays transparent and trustworthy.'
                  )}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={() => navigate('/rentals/requests')}
                  sx={{ minHeight: 48, fontWeight: 700, borderRadius: 2 }}
                >
                  {t('rentals.requestSubmitted.viewRequests', 'My rental requests')}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  onClick={() => navigate('/')}
                  sx={{ minHeight: 48, fontWeight: 600, borderRadius: 2 }}
                >
                  {t('rentals.requestSubmitted.goHome', 'Home')}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Container>
      </Box>
    </>
  );
};

export default RentalRequestSubmittedPage;
