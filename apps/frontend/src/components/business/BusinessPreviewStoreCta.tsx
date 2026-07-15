import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

interface BusinessPreviewStoreCtaProps {
  businessId: string;
}

const BusinessPreviewStoreCta: React.FC<BusinessPreviewStoreCtaProps> = ({
  businessId,
}) => {
  const { t } = useTranslation();
  return (
    <Card
      elevation={0}
      sx={{
        mb: 3,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: (theme) => alpha(theme.palette.background.paper, 1),
      }}
    >
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <StorefrontOutlinedIcon color="primary" sx={{ mt: 0.5 }} />
            <Box>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                {t('stores.previewCtaTitle', 'Preview your store')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'stores.previewCtaBody',
                  'See exactly how customers browse your products — then keep filling the catalog.'
                )}
              </Typography>
            </Box>
          </Box>
          <Button
            component={RouterLink}
            to={`/store/${businessId}?preview=1`}
            variant="outlined"
            startIcon={<StorefrontOutlinedIcon />}
            sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' } }}
          >
            {t('stores.previewCtaButton', 'Preview store')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default BusinessPreviewStoreCta;
