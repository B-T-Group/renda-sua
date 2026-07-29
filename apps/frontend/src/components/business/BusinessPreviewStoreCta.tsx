import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { Box, Link, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

interface BusinessPreviewStoreCtaProps {
  businessId: string;
}

/**
 * Compact secondary action — preview is infrequent, so keep it out of the hero.
 */
const BusinessPreviewStoreCta: React.FC<BusinessPreviewStoreCtaProps> = ({
  businessId,
}) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ mt: 0.5, mb: 1 }}>
      <Link
        component={RouterLink}
        to={`/store/${businessId}?preview=1`}
        underline="hover"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          color: 'primary.main',
          typography: 'body2',
          fontWeight: 600,
        }}
      >
        <StorefrontOutlinedIcon sx={{ fontSize: 18 }} />
        <Typography component="span" variant="body2" fontWeight={600} color="inherit">
          {t('stores.previewCtaButton', 'Preview store')}
        </Typography>
        <Typography component="span" variant="body2" fontWeight={600} color="inherit">
          →
        </Typography>
      </Link>
    </Box>
  );
};

export default BusinessPreviewStoreCta;
