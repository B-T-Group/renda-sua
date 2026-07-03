import {
  Box,
  Container,
  Divider,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import Logo from '../common/Logo';
import AppStoreBadges from '../common/AppStoreBadges';
import { useSessionAuth } from '../../contexts/SessionAuthContext';

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const currentYear = new Date().getFullYear();
  const { isAuthenticated } = useSessionAuth();

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: theme.palette.grey[900],
        color: theme.palette.grey[300],
        py: 4,
        mt: 'auto',
      }}
    >
      <Container maxWidth="xl">
        <Stack spacing={3}>
          {/* Main Footer Content */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'center', md: 'flex-start' }}
            spacing={3}
          >
            {/* Logo and Description + App badges */}
            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <Logo variant="compact" color="white" size="medium" />
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  mb: 2.5,
                  maxWidth: 280,
                  color: theme.palette.grey[400],
                }}
              >
                {t('footer.description')}
              </Typography>
              {!isAuthenticated && (
                <AppStoreBadges variant="compact" sourceSection="footer" />
              )}
            </Box>

            {/* Quick Links */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 2, sm: 4 }}
              sx={{ textAlign: { xs: 'center', md: 'left' } }}
            >
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {t('footer.platform')}
                </Typography>
                <Stack spacing={0.5}>
                  <Typography
                    variant="body2"
                    color="grey.400"
                    component={RouterLink}
                    to="/for-business"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {t('footer.forBusinesses', 'For Businesses')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="grey.400"
                    component={RouterLink}
                    to="/become-a-delivery-agent"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {t('footer.forAgents', 'For Delivery Agents')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="grey.400"
                    component={RouterLink}
                    to="/items"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {t('footer.forClients', 'Browse Items')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="grey.400"
                    component={RouterLink}
                    to="/rentals"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {t('rentals.title', 'Rentals')}
                  </Typography>
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {t('footer.support')}
                </Typography>
                <Stack spacing={0.5}>
                  <Typography
                    variant="body2"
                    color="grey.400"
                    component={RouterLink}
                    to="/faq"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {t('footer.faq', 'FAQ')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="grey.400"
                    component={RouterLink}
                    to="/support"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {t('footer.support', 'Support')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="grey.400"
                    component="a"
                    href="mailto:contact@rendasua.com"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {t('footer.contact', 'Contact us')}
                  </Typography>
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {t('footer.company')}
                </Typography>
                <Stack spacing={0.5}>
                  {!isAuthenticated && (
                    <Typography
                      variant="body2"
                      color="grey.400"
                      component={RouterLink}
                      to="/signup"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      {t('auth.signUp', "Sign Up")}
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    color="grey.400"
                    component={RouterLink}
                    to="/about"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {t('footer.about', 'About')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="grey.400"
                    component={RouterLink}
                    to="/privacy"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {t('footer.privacy', 'Privacy Policy')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="grey.400"
                    component={RouterLink}
                    to="/terms"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {t('footer.terms', 'Terms of Service')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="grey.400"
                    component={RouterLink}
                    to="/profile/delete-request"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {t('footer.deleteAccount', 'Delete account')}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Stack>

          <Divider sx={{ borderColor: theme.palette.grey[800] }} />

          {/* Bottom Section — capped width so a single line is not edge-to-edge */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'center', md: 'center' }}
            spacing={2}
            sx={{
              maxWidth: 720,
              mx: 'auto',
              width: '100%',
            }}
          >
            {/* Copyright */}
            <Typography
              variant="body2"
              color="grey.500"
              sx={{ textAlign: { xs: 'center', md: 'left' } }}
            >
              © {currentYear} Rendasua. {t('footer.allRightsReserved')}
            </Typography>

            {/* Designed By */}
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ textAlign: { xs: 'center', md: 'right' } }}
            >
              <Typography variant="body2" color="grey.500">
                {t('footer.designedBy')}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: theme.palette.primary.main,
                  '&:hover': {
                    color: theme.palette.primary.light,
                  },
                }}
              >
                Aftermath Technologies
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;
