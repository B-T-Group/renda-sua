import { Box, Container, Paper, Typography, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

const AboutUsPage: React.FC = () => {
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
            {t('aboutUs.title', 'About Us')}
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 600, mb: 2 }}
            >
              {t('aboutUs.ourMission', 'Our Mission')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'aboutUs.missionText',
                'At Rendasua, we are dedicated to empowering local businesses, delivery agents, and customers by creating a seamless, efficient marketplace that connects communities and drives economic growth.'
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
              {t('aboutUs.whatWeDo', 'What We Do')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'aboutUs.whatWeDoText',
                'Rendasua is a comprehensive platform that enables local businesses to showcase their products, manage inventory across multiple locations, and reach customers in their community. Our platform facilitates seamless order management, real-time delivery tracking, and efficient payment processing.'
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
              {t('aboutUs.ourValues', 'Our Values')}
            </Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              <Typography component="li" variant="body1" paragraph>
                <strong>{t('aboutUs.community', 'Community First')}:</strong>{' '}
                {t(
                  'aboutUs.communityText',
                  'We believe in strengthening local communities by supporting local businesses and creating opportunities for economic growth.'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                <strong>{t('aboutUs.innovation', 'Innovation')}:</strong>{' '}
                {t(
                  'aboutUs.innovationText',
                  'We continuously innovate to provide cutting-edge solutions that make business operations more efficient and customer experiences more delightful.'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                <strong>{t('aboutUs.transparency', 'Transparency')}:</strong>{' '}
                {t(
                  'aboutUs.transparencyText',
                  'We maintain transparency in all our operations, from pricing to delivery tracking, ensuring trust and reliability for all our users.'
                )}
              </Typography>
              <Typography component="li" variant="body1" paragraph>
                <strong>{t('aboutUs.accessibility', 'Accessibility')}:</strong>{' '}
                {t(
                  'aboutUs.accessibilityText',
                  'We make our platform accessible to businesses of all sizes, from small local shops to larger enterprises, ensuring everyone can benefit from our services.'
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
              {t('aboutUs.ourTeam', 'Our Team')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'aboutUs.teamText',
                'Our team consists of passionate individuals who are committed to revolutionizing the way local businesses operate and serve their communities. We combine expertise in technology, business operations, and customer service to deliver exceptional results.'
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
              {t('aboutUs.contactUs', 'Contact Us')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'aboutUs.contactText',
                'We would love to hear from you! Whether you are a business owner looking to join our platform, a delivery agent interested in opportunities, or a customer with feedback, please reach out to us.'
              )}
            </Typography>
            <Typography variant="body1">
              <strong>{t('aboutUs.email', 'Email')}:</strong>{' '}
              {t('aboutUs.emailAddress', 'contact@rendasua.com')}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {t('aboutUs.lastUpdated', 'Last updated: January 2025')}
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default AboutUsPage;
