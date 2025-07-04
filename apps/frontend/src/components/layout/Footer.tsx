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
import Logo from '../common/Logo';

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const currentYear = new Date().getFullYear();

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
            {/* Logo and Description */}
            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <Logo variant="compact" color="white" size="medium" />
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  maxWidth: 300,
                  color: theme.palette.grey[400],
                }}
              >
                {t('footer.description')}
              </Typography>
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
                  <Typography variant="body2" color="grey.400">
                    {t('footer.forBusinesses')}
                  </Typography>
                  <Typography variant="body2" color="grey.400">
                    {t('footer.forAgents')}
                  </Typography>
                  <Typography variant="body2" color="grey.400">
                    {t('footer.forClients')}
                  </Typography>
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {t('footer.support')}
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="grey.400">
                    {t('footer.helpCenter')}
                  </Typography>
                  <Typography variant="body2" color="grey.400">
                    {t('footer.contact')}
                  </Typography>
                  <Typography variant="body2" color="grey.400">
                    {t('footer.documentation')}
                  </Typography>
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {t('footer.company')}
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="grey.400">
                    {t('footer.about')}
                  </Typography>
                  <Typography variant="body2" color="grey.400">
                    {t('footer.privacy')}
                  </Typography>
                  <Typography variant="body2" color="grey.400">
                    {t('footer.terms')}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Stack>

          <Divider sx={{ borderColor: theme.palette.grey[800] }} />

          {/* Bottom Section */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'center', md: 'center' }}
            spacing={2}
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
