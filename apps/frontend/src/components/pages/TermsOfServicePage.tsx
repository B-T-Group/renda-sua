import { Box, Container, Paper, Typography, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

const TermsOfServicePage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
        py: 4,
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 600,
              color: theme.palette.primary.main,
              textAlign: 'center',
              mb: 4,
            }}
          >
            {t('termsOfService.title', 'Terms of Service')}
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.intro',
                'These Terms of Service ("Terms") govern your use of the Rendasua platform and services. By accessing or using our platform, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our services.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t('termsOfService.acceptance', 'Acceptance of Terms')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.acceptanceText',
                'By creating an account, placing an order, or using any of our services, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t('termsOfService.userAccounts', 'User Accounts')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.accountsText',
                'To use certain features of our platform, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information when creating your account.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t('termsOfService.userTypes', 'User Types and Responsibilities')}
            </Typography>

            <Typography
              variant="h6"
              component="h3"
              gutterBottom
              sx={{ fontWeight: 500, mb: 1 }}
            >
              {t('termsOfService.businessUsers', 'Business Users')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.businessUsersText',
                'Business users are responsible for accurately listing their products, maintaining adequate inventory, fulfilling orders in a timely manner, and providing quality customer service. You must comply with all applicable laws and regulations in your jurisdiction.'
              )}
            </Typography>

            <Typography
              variant="h6"
              component="h3"
              gutterBottom
              sx={{ fontWeight: 500, mb: 1 }}
            >
              {t('termsOfService.deliveryAgents', 'Delivery Agents')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.deliveryAgentsText',
                'Delivery agents are responsible for safely and timely delivering orders to customers. You must maintain appropriate insurance, follow traffic laws, and treat customers and their property with respect.'
              )}
            </Typography>

            <Typography
              variant="h6"
              component="h3"
              gutterBottom
              sx={{ fontWeight: 500, mb: 1 }}
            >
              {t('termsOfService.customers', 'Customers')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.customersText',
                'Customers are responsible for providing accurate delivery information, being available for delivery, and treating delivery agents with respect. You must pay for orders in accordance with our payment terms.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t('termsOfService.ordersAndPayments', 'Orders and Payments')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.ordersText',
                'All orders are subject to acceptance by the business. We reserve the right to refuse or cancel any order at our discretion. Payment must be made in advance or upon delivery as specified in the order. Refunds are subject to our refund policy.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t('termsOfService.prohibitedUses', 'Prohibited Uses')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.prohibitedText',
                'You may not use our platform for any unlawful purpose or in any way that could damage, disable, or impair our services. Prohibited activities include but are not limited to:'
              )}
            </Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'termsOfService.prohibited1',
                  'Violating any applicable laws or regulations'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'termsOfService.prohibited2',
                  'Infringing on intellectual property rights'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'termsOfService.prohibited3',
                  'Transmitting harmful or malicious code'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'termsOfService.prohibited4',
                  'Harassing or abusing other users'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'termsOfService.prohibited5',
                  'Attempting to gain unauthorized access to our systems'
                )}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t(
                'termsOfService.intellectualProperty',
                'Intellectual Property'
              )}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.ipText',
                'The Rendasua platform and its content are protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works based on our platform without our express written permission.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t('termsOfService.disclaimers', 'Disclaimers')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.disclaimersText',
                'Our platform is provided "as is" without warranties of any kind. We do not guarantee that our services will be uninterrupted, error-free, or completely secure. We are not responsible for the quality, safety, or legality of products sold by business users.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t(
                'termsOfService.limitationOfLiability',
                'Limitation of Liability'
              )}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.liabilityText',
                'To the maximum extent permitted by law, Rendasua shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our platform or services.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t('termsOfService.termination', 'Termination')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.terminationText',
                'We may terminate or suspend your account at any time for violation of these Terms or for any other reason at our discretion. You may also terminate your account at any time by contacting us.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t('termsOfService.changes', 'Changes to Terms')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.changesText',
                'We reserve the right to modify these Terms at any time. We will notify users of significant changes by email or through our platform. Continued use of our services after changes constitutes acceptance of the new Terms.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t('termsOfService.governingLaw', 'Governing Law')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.governingLawText',
                'These Terms are governed by and construed in accordance with the laws of the jurisdiction where Rendasua is incorporated, without regard to conflict of law principles.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t('termsOfService.contactUs', 'Contact Us')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'termsOfService.contactText',
                'If you have any questions about these Terms of Service, please contact us:'
              )}
            </Typography>
            <Typography variant="body1">
              <strong>{t('termsOfService.email', 'Email')}:</strong>{' '}
              {t('termsOfService.emailAddress', 'legal@rendasua.com')}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {t('termsOfService.lastUpdated', 'Last updated: January 2025')}
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default TermsOfServicePage;
