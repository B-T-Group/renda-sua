import { Box, Container, Paper, Typography, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

const PrivacyPolicyPage: React.FC = () => {
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
            {t('privacyPolicy.title', 'Privacy Policy')}
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography variant="body1" paragraph>
              {t(
                'privacyPolicy.intro',
                'This Privacy Policy describes how Rendasua ("we," "our," or "us") collects, uses, and protects your information when you use our platform and services. We are committed to protecting your privacy and ensuring the security of your personal information.'
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
                'privacyPolicy.informationWeCollect',
                'Information We Collect'
              )}
            </Typography>

            <Typography
              variant="h6"
              component="h3"
              gutterBottom
              sx={{ fontWeight: 500, mb: 1 }}
            >
              {t('privacyPolicy.personalInformation', 'Personal Information')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'privacyPolicy.personalInfoText',
                'We collect personal information that you provide directly to us, such as when you create an account, place an order, or contact us. This may include your name, email address, phone number, address, and payment information.'
              )}
            </Typography>

            <Typography
              variant="h6"
              component="h3"
              gutterBottom
              sx={{ fontWeight: 500, mb: 1 }}
            >
              {t('privacyPolicy.usageInformation', 'Usage Information')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'privacyPolicy.usageInfoText',
                'We automatically collect certain information about your use of our platform, including your IP address, browser type, device information, pages visited, and time spent on our platform.'
              )}
            </Typography>

            <Typography
              variant="h6"
              component="h3"
              gutterBottom
              sx={{ fontWeight: 500, mb: 1 }}
            >
              {t('privacyPolicy.businessInformation', 'Business Information')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'privacyPolicy.businessInfoText',
                'For business users, we collect additional information such as business name, business address, tax information, and business documents to verify and manage your business account.'
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
                'privacyPolicy.howWeUseInformation',
                'How We Use Your Information'
              )}
            </Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'privacyPolicy.use1',
                  'To provide and maintain our services'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t('privacyPolicy.use2', 'To process orders and payments')}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'privacyPolicy.use3',
                  'To communicate with you about your account and orders'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'privacyPolicy.use4',
                  'To improve our platform and services'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t('privacyPolicy.use5', 'To comply with legal obligations')}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'privacyPolicy.use6',
                  'To prevent fraud and ensure platform security'
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
              {t('privacyPolicy.informationSharing', 'Information Sharing')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'privacyPolicy.sharingText',
                'We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:'
              )}
            </Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'privacyPolicy.share1',
                  'With service providers who assist us in operating our platform'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'privacyPolicy.share2',
                  'With delivery agents to fulfill your orders'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t(
                  'privacyPolicy.share3',
                  'When required by law or to protect our rights'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                {t('privacyPolicy.share4', 'With your explicit consent')}
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
              {t('privacyPolicy.dataSecurity', 'Data Security')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'privacyPolicy.securityText',
                'We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.'
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
              {t('privacyPolicy.yourRights', 'Your Rights')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'privacyPolicy.rightsText',
                'You have the right to access, update, or delete your personal information. You may also opt out of certain communications from us. To exercise these rights, please contact us using the information provided below.'
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
              {t('privacyPolicy.cookies', 'Cookies and Tracking')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'privacyPolicy.cookiesText',
                'We use cookies and similar tracking technologies to enhance your experience on our platform, analyze usage patterns, and provide personalized content. You can control cookie settings through your browser preferences.'
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
              {t('privacyPolicy.changes', 'Changes to This Policy')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'privacyPolicy.changesText',
                'We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy periodically.'
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
              {t('privacyPolicy.contactUs', 'Contact Us')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'privacyPolicy.contactText',
                'If you have any questions about this Privacy Policy or our privacy practices, please contact us:'
              )}
            </Typography>
            <Typography variant="body1">
              <strong>{t('privacyPolicy.email', 'Email')}:</strong>{' '}
              {t('privacyPolicy.emailAddress', 'privacy@rendasua.com')}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {t('privacyPolicy.lastUpdated', 'Last updated: January 2025')}
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default PrivacyPolicyPage;
