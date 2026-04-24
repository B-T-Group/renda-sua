import {
  Box,
  Chip,
  Container,
  Grid,
  Link,
  Paper,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { AboutUsOfficeEntry } from './aboutUsOfficesData';
import { ABOUT_US_OFFICE_ENTRIES } from './aboutUsOfficesData';

function OfficeLocationCard({ office }: { office: AboutUsOfficeEntry }) {
  const { t } = useTranslation();
  const name = t(`aboutUs.offices.items.${office.id}.name`, office.nameDefault);
  const telHref = `tel:${office.phone.replace(/[^\d+]/g, '')}`;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        height: '100%',
        borderRadius: 2,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
          {name}
        </Typography>
        {office.isHeadOffice ? (
          <Chip
            size="small"
            label={t('aboutUs.offices.headOfficeBadge', 'Head office')}
            color="primary"
            variant="outlined"
          />
        ) : null}
      </Box>
      <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 1 }}>
        <strong>{t('aboutUs.offices.addressLabel', 'Address')}:</strong> {office.address}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 1 }}>
        <strong>{t('aboutUs.offices.phoneLabel', 'Phone')}:</strong>{' '}
        <Link href={telHref} color="inherit" underline="hover">
          {office.phone}
        </Link>
      </Typography>
      <Typography variant="body2" color="text.secondary">
        <strong>{t('aboutUs.email', 'Email')}:</strong>{' '}
        <Link href={`mailto:${office.email}`} underline="hover">
          {office.email}
        </Link>
      </Typography>
    </Paper>
  );
}

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
      <Container maxWidth="lg">
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
            <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              {t('aboutUs.whoWeAre', 'Who we are')}
            </Typography>
            <Typography variant="body1" paragraph>
              <Trans
                i18nKey="aboutUs.companyIntro"
                defaults="Rendasua is a Canadian-owned company, owned by <groupeLink>Groupe BT</groupeLink>. We were founded in 2023 and first launched in Gabon to make deliveries easier. Since 2025, we have expanded beyond deliveries to support online sales as well."
                components={{
                  groupeLink: (
                    <Link
                      href="https://www.groupe-bt.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ),
                }}
              />
            </Typography>
            <Typography variant="body1" paragraph sx={{ mb: 0 }}>
              {t(
                'aboutUs.parentCompanyText',
                'Groupe B&T is a project and facilities management company focused on real estate and socioeconomic innovation.'
              )}
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
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
            <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
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
            <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              {t('aboutUs.ourOffices', 'Where to find us')}
            </Typography>
            <Typography variant="body1" paragraph>
              {t(
                'aboutUs.offices.intro',
                'Our teams work across Canada, Central Africa, and West Africa. Reach the location closest to you using the details below.'
              )}
            </Typography>
            <Grid container spacing={2}>
              {ABOUT_US_OFFICE_ENTRIES.map((office) => (
                <Grid key={office.id} size={{ xs: 12, md: 6 }}>
                  <OfficeLocationCard office={office} />
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
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
            <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
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
            <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
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
              {t('aboutUs.lastUpdated', 'Last updated: April 2026')}
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default AboutUsPage;
